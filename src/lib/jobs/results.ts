import "server-only";

import { mapRecord } from "@/lib/fullenrich/mapping";
import type { EnrichmentRecord, EnrichmentResult, EnrichmentStatus } from "@/lib/fullenrich/types";
import type { Database, Json, TablesUpdate } from "@/lib/supabase/types";
import { log, type Admin, type BatchRow } from "./shared";

type BatchStatus = Database["public"]["Enums"]["batch_status"];

/** Provider batch status → ours. Unknown statuses settle as `failed` but keep any data. */
export function batchStatusFromProvider(status: EnrichmentStatus): BatchStatus {
  switch (status) {
    case "FINISHED":
      return "finished";
    case "CREDITS_INSUFFICIENT":
      return "credits_insufficient";
    case "CANCELED":
      return "canceled";
    default:
      return "failed";
  }
}

/** Column patch for one provider record (pure, shared with the parse-time cache fill). */
export function contactPatchFromRecord(record: EnrichmentRecord, now = new Date().toISOString()): TablesUpdate<"list_contacts"> {
  const m = mapRecord(record);
  return {
    status: m.found ? "enriched" : "not_found",
    work_email: m.work_email,
    work_email_status: m.work_email_status,
    personal_email: m.personal_email,
    personal_email_status: m.personal_email_status,
    phone: m.phone,
    phone_meta: m.phone_meta as unknown as Json,
    job_title: m.job_title,
    company: m.company,
    company_domain: m.company_domain,
    company_logo_url: m.company_logo_url,
    location: m.location,
    linkedin_url: m.linkedin_url,
    profile: m.profile as unknown as Json,
    result: record as unknown as Json,
    credits_cost: m.credits_cost,
    enriched_at: now,
  };
}

/**
 * Write provider records onto the contacts of a batch (idempotent: the same
 * record from a contact event and the batch event yields the same row) and
 * write-through to `enrichment_cache`.
 */
export async function applyRecords(
  admin: Admin,
  batch: Pick<BatchRow, "id" | "workspace_id" | "list_id">,
  records: readonly EnrichmentRecord[],
  fields: readonly string[],
): Promise<{ applied: number; cached: number }> {
  let applied = 0;
  let cached = 0;
  const now = new Date().toISOString();
  for (const record of records) {
    const contactId = record.custom?.contact_id;
    if (!contactId) continue;
    const { data: row, error } = await admin
      .from("list_contacts")
      .update(contactPatchFromRecord(record, now))
      .eq("id", contactId)
      .eq("batch_id", batch.id)
      .select("input_hash")
      .maybeSingle();
    if (error) {
      log("results.apply_failed", { batchId: batch.id, contactId, error: error.message });
      continue;
    }
    if (!row) continue;
    applied += 1;
    if (row.input_hash && record.contact_info) {
      const { error: cacheErr } = await admin.from("enrichment_cache").upsert(
        {
          input_hash: row.input_hash,
          fields: [...fields],
          result: record as unknown as Json,
          source_workspace_id: batch.workspace_id,
          fetched_at: now,
        },
        { onConflict: "input_hash" },
      );
      if (!cacheErr) cached += 1;
    }
  }
  return { applied, cached };
}

/**
 * A batch reached a terminal provider status: apply every record, resolve
 * contacts that got no record (silentFail drops invalid rows), and mark the
 * batch so the settler can charge it exactly once.
 */
export async function applyTerminalResult(
  admin: Admin,
  batch: Pick<BatchRow, "id" | "workspace_id" | "list_id">,
  result: EnrichmentResult,
  fields: readonly string[],
): Promise<{ status: BatchStatus; applied: number }> {
  const status = batchStatusFromProvider(result.status);
  const { applied } = await applyRecords(admin, batch, result.data ?? [], fields);

  // Contacts still `submitted` got no result.
  if (status === "credits_insufficient") {
    // Upstream ran dry mid-batch: these rows resume once the account is topped up.
    await admin.from("list_contacts").update({ status: "pending", batch_id: null }).eq("batch_id", batch.id).eq("status", "submitted");
  } else {
    await admin
      .from("list_contacts")
      .update({ status: "failed", skip_reason: "no_result", enriched_at: new Date().toISOString() })
      .eq("batch_id", batch.id)
      .eq("status", "submitted");
  }

  const credits = typeof result.cost?.credits === "number" ? Math.max(0, Math.round(result.cost.credits)) : null;
  await admin
    .from("enrichment_batches")
    .update({
      status,
      credits_cost: credits,
      finished_at: new Date().toISOString(),
      raw: { status: result.status, cost: result.cost ?? null, records: result.data?.length ?? 0 } as Json,
    })
    .eq("id", batch.id)
    .eq("status", "submitted");

  log("results.batch_terminal", { batchId: batch.id, listId: batch.list_id, status, applied, credits });
  return { status, applied };
}
