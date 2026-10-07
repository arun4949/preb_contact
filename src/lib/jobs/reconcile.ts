import "server-only";

import { getBulkEnrichment, getReverseEmailLookup, ProviderError } from "@/lib/fullenrich/client";
import type { EnrichmentResult } from "@/lib/fullenrich/types";
import { pauseUpstream } from "./dispatch";
import { claimRateSlot } from "./rate-limit";
import { applyTerminalResult } from "./results";
import { finalizeList, settleBatch } from "./settle";
import { log, logError, minutesAgo, PROVIDER, revertBatchContacts, type Admin } from "./shared";

export interface ReconcileSummary {
  polled: number;
  finished: number;
  stale: number;
  rateLimited: boolean;
}

/** Poll a batch only after this long without a webhook… */
const NO_WEBHOOK_MINUTES = 15;
/** …and then at most once per this interval. */
const POLL_INTERVAL_MINUTES = 10;
/** Batches that never got a provider id (crash between claim and submit). */
const STALE_UNSUBMITTED_MINUTES = 5;
const POLLS_PER_TICK = 10;

/**
 * Safety net for missed webhooks (tunnel down, retries exhausted): poll
 * batches the provider has not reported on, within the GET budget.
 */
export async function reconcile(admin: Admin): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { polled: 0, finished: 0, stale: 0, rateLimited: false };

  // 1) Claimed but never submitted → release the rows.
  const { data: stale } = await admin
    .from("enrichment_batches")
    .select("id, list_id")
    .eq("status", "submitted")
    .is("provider_enrichment_id", null)
    .lt("submitted_at", minutesAgo(STALE_UNSUBMITTED_MINUTES))
    .limit(20);
  for (const b of stale ?? []) {
    await revertBatchContacts(admin, b.id);
    await admin.from("enrichment_batches").delete().eq("id", b.id);
    summary.stale += 1;
    log("reconcile.stale_batch_released", { batchId: b.id, listId: b.list_id });
  }

  // 2) Submitted batches without a terminal webhook.
  const { data: batches } = await admin
    .from("enrichment_batches")
    .select("*")
    .eq("status", "submitted")
    .eq("provider", PROVIDER)
    .not("provider_enrichment_id", "is", null)
    .lt("submitted_at", minutesAgo(NO_WEBHOOK_MINUTES))
    .or(`last_polled_at.is.null,last_polled_at.lt.${minutesAgo(POLL_INTERVAL_MINUTES)}`)
    .order("submitted_at", { ascending: true })
    .limit(POLLS_PER_TICK);

  for (const batch of batches ?? []) {
    if (!(await claimRateSlot(admin, "get"))) {
      summary.rateLimited = true;
      break;
    }
    summary.polled += 1;
    await admin
      .from("enrichment_batches")
      .update({ last_polled_at: new Date().toISOString(), attempts: batch.attempts + 1 })
      .eq("id", batch.id);

    const { data: list } = await admin.from("lists").select("*").eq("id", batch.list_id).maybeSingle();
    if (!list) continue;
    const id = batch.provider_enrichment_id!;

    try {
      const result = batch.kind === "reverse" ? await getReverseEmailLookup(id) : await getBulkEnrichment(id);
      await applyTerminalResult(admin, batch, result, list.enrich_fields);
      await settleBatch(admin, batch.id);
      await finalizeList(admin, list.id);
      summary.finished += 1;
    } catch (error) {
      if (!(error instanceof ProviderError)) {
        logError("reconcile.poll_failed", error, { batchId: batch.id, enrichmentId: id });
        continue;
      }
      if (error.isInProgress) {
        log("reconcile.in_progress", { batchId: batch.id, attempts: batch.attempts + 1 });
        continue;
      }
      if (error.isRateLimited) {
        summary.rateLimited = true;
        break;
      }
      if (error.isInsufficientCredits) {
        const body = error.body as Partial<EnrichmentResult> | null;
        const partial: EnrichmentResult = { id, name: body?.name ?? "", status: "CREDITS_INSUFFICIENT", cost: body?.cost, data: body?.data ?? [] };
        await applyTerminalResult(admin, batch, partial, list.enrich_fields);
        await settleBatch(admin, batch.id);
        await pauseUpstream(admin, list, list.status, "GET on a batch returned 402 (upstream credits exhausted).");
        summary.finished += 1;
        continue;
      }
      if (error.isNotFound) {
        // The provider lost it (or >3 months): fail the rows so the list can finish.
        await admin
          .from("list_contacts")
          .update({ status: "failed", skip_reason: "provider_lost", enriched_at: new Date().toISOString() })
          .eq("batch_id", batch.id)
          .eq("status", "submitted");
        await admin
          .from("enrichment_batches")
          .update({ status: "failed", credits_cost: 0, finished_at: new Date().toISOString(), raw: { error: "not_found" } })
          .eq("id", batch.id);
        await settleBatch(admin, batch.id);
        await finalizeList(admin, list.id);
        summary.finished += 1;
        logError("reconcile.batch_lost", error, { batchId: batch.id, enrichmentId: id });
        continue;
      }
      logError("reconcile.provider_error", error, { batchId: batch.id, status: error.status, code: error.code });
    }
  }
  return summary;
}
