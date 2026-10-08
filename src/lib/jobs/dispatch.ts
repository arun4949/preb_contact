import "server-only";

import { ProviderError, startBulkEnrichment, startReverseEmailLookup } from "@/lib/fullenrich/client";
import type { EnrichmentRecord } from "@/lib/fullenrich/types";
import type { Json } from "@/lib/supabase/types";
import { notifyListPaused, notifyOps } from "./notify";
import { buildEnrichPayload, buildReversePayload } from "./payload";
import { claimRateSlot } from "./rate-limit";
import { applyRecords } from "./results";
import { settleBatch } from "./settle";
import {
  BATCH_SIZE,
  CACHE_PROVIDER,
  CACHE_TTL_DAYS,
  CONTACT_KINDS,
  countPendingOfKind,
  countUpstreamRows,
  log,
  logError,
  minutesAgo,
  PROVIDER,
  releaseHolds,
  revertBatchContacts,
  spendableCredits,
  webhookUrl,
  type Admin,
  type ContactKind,
  type ListRow,
} from "./shared";

export interface DispatchSummary {
  lists: number;
  batches: number;
  submitted: number;
  fromCache: number;
  paused: number;
  rateLimited: boolean;
  upstreamPaused: boolean;
}

/** Max provider batches per list per tick, so several lists share the minute budget. */
const BATCHES_PER_LIST = 4;
/** A list in `paused_upstream` is retried this often. */
const UPSTREAM_RETRY_MINUTES = 15;
/** Consecutive provider rejections (within an hour) before a list is marked failed. */
const MAX_FAILED_BATCHES = 3;

/**
 * Submit pending contacts of runnable lists to the provider in batches of
 * ≤100, within the per-minute budget, while the workspace still has credits.
 */
export async function dispatch(admin: Admin): Promise<DispatchSummary> {
  const summary: DispatchSummary = { lists: 0, batches: 0, submitted: 0, fromCache: 0, paused: 0, rateLimited: false, upstreamPaused: false };
  const hook = webhookUrl();

  const { data: active } = await admin
    .from("lists")
    .select("*")
    .in("status", ["queued", "enriching", "paused_credits"])
    .order("started_at", { ascending: true, nullsFirst: false })
    .limit(20);
  const { data: retry } = await admin
    .from("lists")
    .select("*")
    .eq("status", "paused_upstream")
    .lt("updated_at", minutesAgo(UPSTREAM_RETRY_MINUTES))
    .order("updated_at", { ascending: true })
    .limit(5);

  for (const list of [...(active ?? []), ...(retry ?? [])]) {
    if (summary.rateLimited || summary.upstreamPaused) break;
    summary.lists += 1;
    try {
      await dispatchList(admin, list, hook, summary);
    } catch (error) {
      logError("dispatch.list_failed", error, { listId: list.id });
    }
  }
  return summary;
}

async function dispatchList(admin: Admin, list: ListRow, hook: string, summary: DispatchSummary) {
  let status = list.status;

  // Row limit: how many more rows may go out.
  let remaining = Number.POSITIVE_INFINITY;
  if (list.row_limit) {
    remaining = list.row_limit - (await countUpstreamRows(admin, list.id));
    if (remaining <= 0) return; // finalize() skips the rest
  }

  // One pass per contact kind: enrich rows go to the bulk endpoint, email-only
  // rows (reverse lookup opted in) to the reverse endpoint. Batches never mix.
  for (const kind of CONTACT_KINDS) for (let round = 0; round < BATCHES_PER_LIST; round += 1) {
    if (remaining <= 0) return;
    const pendingCount = await countPendingOfKind(admin, list.id, kind);
    if (pendingCount === 0) break;

    // Credits: the list may spend the workspace balance plus its own hold.
    const spendable = await spendableCredits(admin, list);
    if (spendable <= 0) {
      if (status !== "paused_credits") {
        const { data: updated } = await admin
          .from("lists")
          .update({ status: "paused_credits" })
          .eq("id", list.id)
          .eq("status", status)
          .select("*")
          .maybeSingle();
        if (updated) {
          summary.paused += 1;
          log("dispatch.paused_credits", { listId: list.id, pending: pendingCount });
          await notifyListPaused(admin, updated, pendingCount);
        }
      }
      return;
    }

    // Cross-workspace cache (F2): served from our cache, charged normally, no provider call.
    const cacheServed = await serveFromCache(admin, list, Math.min(BATCH_SIZE, remaining), kind);
    if (cacheServed > 0) {
      summary.fromCache += cacheServed;
      summary.batches += 1;
      remaining -= cacheServed;
      status = await markEnriching(admin, list.id, status);
      continue;
    }

    // Provider submission.
    if (!(await claimRateSlot(admin, "submit"))) {
      summary.rateLimited = true;
      log("dispatch.rate_limited", { listId: list.id });
      return;
    }

    const { data: batch, error: batchErr } = await admin
      .from("enrichment_batches")
      .insert({ list_id: list.id, workspace_id: list.workspace_id, kind, provider: PROVIDER, status: "submitted" })
      .select("*")
      .single();
    if (batchErr || !batch) throw new Error(`Could not create batch: ${batchErr?.message}`);

    const { data: contacts, error: claimErr } = await admin.rpc("claim_pending_contacts", {
      p_list_id: list.id,
      p_batch_id: batch.id,
      p_limit: Math.min(BATCH_SIZE, remaining),
      p_kind: kind,
    });
    if (claimErr) throw new Error(`claim_pending_contacts failed: ${claimErr.message}`);
    if (!contacts || contacts.length === 0) {
      await admin.from("enrichment_batches").delete().eq("id", batch.id);
      return;
    }

    try {
      const { enrichment_id } =
        kind === "reverse"
          ? await startReverseEmailLookup(buildReversePayload(list, batch.id, contacts, hook))
          : await startBulkEnrichment(buildEnrichPayload(list, batch.id, contacts, hook));

      await admin
        .from("enrichment_batches")
        .update({ provider_enrichment_id: enrichment_id, contact_count: contacts.length, submitted_at: new Date().toISOString() })
        .eq("id", batch.id);
      summary.batches += 1;
      summary.submitted += contacts.length;
      remaining -= contacts.length;
      status = await markEnriching(admin, list.id, status);
      log("dispatch.submitted", { listId: list.id, batchId: batch.id, kind, enrichmentId: enrichment_id, contacts: contacts.length });
    } catch (error) {
      await revertBatchContacts(admin, batch.id);
      const provider = error instanceof ProviderError ? error : null;

      if (provider?.isRateLimited) {
        await admin.from("enrichment_batches").delete().eq("id", batch.id);
        summary.rateLimited = true;
        log("dispatch.provider_429", { listId: list.id });
        return;
      }

      await admin
        .from("enrichment_batches")
        .update({ status: "failed", finished_at: new Date().toISOString(), settled_at: new Date().toISOString(), raw: errorJson(error) })
        .eq("id", batch.id);

      if (provider?.isInsufficientCredits) {
        summary.upstreamPaused = true;
        await pauseUpstream(admin, list, status, "The enrichment provider rejected a batch with 402 (insufficient upstream credits).");
        return;
      }

      logError("dispatch.submit_failed", error, { listId: list.id, batchId: batch.id, status: provider?.status, code: provider?.code });
      const { count: failures } = await admin
        .from("enrichment_batches")
        .select("id", { count: "exact", head: true })
        .eq("list_id", list.id)
        .eq("status", "failed")
        .is("provider_enrichment_id", null)
        .gte("created_at", minutesAgo(60));
      if ((failures ?? 0) >= MAX_FAILED_BATCHES) {
        await admin
          .from("lists")
          .update({ status: "failed", error: "The enrichment service rejected this list repeatedly. Our team has been notified." })
          .eq("id", list.id)
          .eq("status", status);
        await releaseHolds(admin, list.id);
        await notifyOps("List failed after repeated provider rejections", [
          `list_id: ${list.id}`,
          `workspace_id: ${list.workspace_id}`,
          `last error: ${provider ? `${provider.status} ${provider.code ?? ""}` : String(error)}`,
        ]);
      }
      return;
    }
  }
}

async function markEnriching(admin: Admin, listId: string, current: ListRow["status"]): Promise<ListRow["status"]> {
  if (current === "enriching") return current;
  await admin.from("lists").update({ status: "enriching", error: null }).eq("id", listId).eq("status", current);
  return "enriching";
}

async function pauseUpstream(admin: Admin, list: ListRow, current: ListRow["status"], reason: string) {
  const { data: updated } = await admin
    .from("lists")
    .update({ status: "paused_upstream", error: "Enrichment is temporarily paused on our side. It resumes automatically." })
    .eq("id", list.id)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  log("dispatch.paused_upstream", { listId: list.id, reason });
  if (updated && current !== "paused_upstream") {
    await notifyOps("Upstream credits exhausted — lists paused", [reason, `list_id: ${list.id}`, `workspace_id: ${list.workspace_id}`, "Top up the provider account; lists retry every 15 minutes."]);
  }
}

export { pauseUpstream };

function errorJson(error: unknown): Json {
  if (error instanceof ProviderError) return { status: error.status, code: error.code ?? null, body: (error.body ?? null) as Json };
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * Serve pending contacts whose input was enriched (by any workspace) within
 * 90 days from `enrichment_cache`. They go through a synthetic batch so the
 * settler charges them like provider rows. Returns the number served.
 */
async function serveFromCache(admin: Admin, list: ListRow, limit: number, kind: ContactKind): Promise<number> {
  const { data: pending } = await admin
    .from("list_contacts")
    .select("id, input_hash")
    .eq("list_id", list.id)
    .eq("status", "pending")
    .eq("kind", kind)
    .not("input_hash", "is", null)
    .order("row_index")
    .limit(limit);
  const hashes = [...new Set((pending ?? []).map((c) => c.input_hash!).filter(Boolean))];
  if (hashes.length === 0) return 0;

  const since = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
  const { data: hits } = await admin
    .from("enrichment_cache")
    .select("input_hash, fields, result, source_workspace_id")
    .in("input_hash", hashes)
    .gte("fetched_at", since);
  const usable = new Map<string, EnrichmentRecord>();
  const ownHashes = new Set<string>();
  const required = kind === "reverse" ? ["reverse"] : list.enrich_fields;
  for (const hit of hits ?? []) {
    // Only reuse when the cached run covered every field this list asks for.
    if (!required.every((f) => hit.fields.includes(f))) continue;
    usable.set(hit.input_hash, hit.result as unknown as EnrichmentRecord);
    if (hit.source_workspace_id === list.workspace_id) ownHashes.add(hit.input_hash);
  }
  if (usable.size === 0) return 0;

  const targets = (pending ?? []).filter((c) => c.input_hash && usable.has(c.input_hash));
  const { data: batch } = await admin
    .from("enrichment_batches")
    .insert({ list_id: list.id, workspace_id: list.workspace_id, kind, provider: CACHE_PROVIDER, status: "submitted" })
    .select("*")
    .single();
  if (!batch) return 0;

  const { data: claimed } = await admin
    .from("list_contacts")
    .update({ status: "submitted", batch_id: batch.id })
    .in(
      "id",
      targets.map((t) => t.id),
    )
    .eq("status", "pending")
    .select("id, input_hash");
  if (!claimed || claimed.length === 0) {
    await admin.from("enrichment_batches").delete().eq("id", batch.id);
    return 0;
  }

  const records: EnrichmentRecord[] = claimed.map((c) => ({
    ...usable.get(c.input_hash!)!,
    custom: { contact_id: c.id, list_id: list.id, batch_id: batch.id },
  }));
  await applyRecords(admin, batch, records, list.enrich_fields);
  // Same-workspace hits are free and shown as "Already enriched" (like parse-time hits).
  const ownIds = claimed.filter((c) => ownHashes.has(c.input_hash!)).map((c) => c.id);
  if (ownIds.length) {
    await admin.from("list_contacts").update({ status: "cached", credits_cost: 0 }).in("id", ownIds).eq("batch_id", batch.id);
  }
  await admin
    .from("list_contacts")
    .update({ status: "failed", skip_reason: "no_result" })
    .eq("batch_id", batch.id)
    .eq("status", "submitted");
  await admin
    .from("enrichment_batches")
    .update({ status: "finished", contact_count: claimed.length, finished_at: new Date().toISOString(), raw: { source: "cache" } })
    .eq("id", batch.id);
  await settleBatch(admin, batch.id);
  log("dispatch.cache_served", { listId: list.id, batchId: batch.id, kind, contacts: claimed.length });
  return claimed.length;
}
