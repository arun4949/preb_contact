import { NextResponse } from "next/server";
import { verifySignature } from "@/lib/fullenrich/signature";
import type { EnrichmentResult } from "@/lib/fullenrich/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { pauseUpstream } from "@/lib/jobs/dispatch";
import { applyRecords, applyTerminalResult } from "@/lib/jobs/results";
import { finalizeList, settleBatch } from "@/lib/jobs/settle";
import { log, logError, PROVIDER } from "@/lib/jobs/shared";
import type { Json } from "@/lib/supabase/types";

export const maxDuration = 60;

/**
 * Provider webhook. Two shapes share one URL: per-contact events (`status:
 * IN_PROGRESS`, one record) and the terminal batch event (body = GET result).
 * HMAC-SHA1 over the raw body, idempotent by `webhook_events.external_id`,
 * 200 fast; non-2xx makes the provider retry (×5, every minute).
 */
export async function POST(request: Request) {
  const secret = process.env.FULLENRICH_API_KEY;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("x-signature-sha1"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: EnrichmentResult;
  try {
    body = JSON.parse(raw) as EnrichmentResult;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body.id !== "string" || !body.status) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const isContactEvent = body.status === "IN_PROGRESS" || body.status === "CREATED";
  const externalId = isContactEvent
    ? `${body.id}:${body.data?.[0]?.custom?.contact_id ?? "unknown"}:contact`
    : `${body.id}:batch:${body.status}`;

  const admin = createAdminClient();
  await admin
    .from("webhook_events")
    .upsert({ provider: PROVIDER, external_id: externalId, payload: body as unknown as Json }, { onConflict: "provider,external_id", ignoreDuplicates: true });
  const { data: event } = await admin.from("webhook_events").select("id, processed_at").eq("provider", PROVIDER).eq("external_id", externalId).maybeSingle();
  if (event?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const { data: batch } = await admin.from("enrichment_batches").select("*").eq("provider_enrichment_id", body.id).maybeSingle();
    if (!batch) {
      await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: "unknown batch" }).eq("external_id", externalId).eq("provider", PROVIDER);
      log("webhook.unknown_batch", { enrichmentId: body.id });
      return NextResponse.json({ ok: true, ignored: true });
    }
    const { data: list } = await admin.from("lists").select("*").eq("id", batch.list_id).maybeSingle();
    const fields = list?.enrich_fields ?? [];

    if (isContactEvent) {
      const { applied } = await applyRecords(admin, batch, body.data ?? [], fields);
      log("webhook.contact", { batchId: batch.id, applied });
    } else {
      const { status } = await applyTerminalResult(admin, batch, body, fields);
      await settleBatch(admin, batch.id);
      if (status === "credits_insufficient" && list) {
        await pauseUpstream(admin, list, list.status, "Batch finished with CREDITS_INSUFFICIENT (upstream credits exhausted).");
      }
      await finalizeList(admin, batch.list_id);
    }

    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("external_id", externalId).eq("provider", PROVIDER);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("webhook.failed", error, { externalId });
    await admin
      .from("webhook_events")
      .update({ error: error instanceof Error ? error.message : String(error) })
      .eq("external_id", externalId)
      .eq("provider", PROVIDER);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
