import "server-only";

import { notifyListFinished } from "./notify";
import { countContacts, countUpstreamRows, log, logError, releaseHolds, type Admin } from "./shared";

/** Charge one terminal batch exactly once (`settle_batch` is atomic and idempotent). */
export async function settleBatch(admin: Admin, batchId: string): Promise<{ charged: number; consumed: number; derived: number } | null> {
  const { data, error } = await admin.rpc("settle_batch", { p_batch_id: batchId });
  if (error) throw new Error(`settle_batch failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  log("settle.batch", { batchId, ...row });
  return row;
}

/** Safety net: settle anything terminal that the webhook path did not settle. */
export async function settlePending(admin: Admin): Promise<number> {
  const { data: batches } = await admin
    .from("enrichment_batches")
    .select("id, list_id")
    .neq("status", "submitted")
    .is("settled_at", null)
    .order("finished_at", { ascending: true, nullsFirst: true })
    .limit(50);
  let settled = 0;
  for (const b of batches ?? []) {
    try {
      if (await settleBatch(admin, b.id)) settled += 1;
    } catch (error) {
      logError("settle.failed", error, { batchId: b.id, listId: b.list_id });
    }
  }
  return settled;
}

/**
 * Move a list to its terminal state when nothing is left in flight:
 * enriching → completed, stopping → stopped. Also applies `row_limit` by
 * skipping pending rows beyond the limit. Idempotent; guarded by status.
 */
export async function finalizeList(admin: Admin, listId: string): Promise<"completed" | "stopped" | null> {
  const { data: list } = await admin.from("lists").select("*").eq("id", listId).maybeSingle();
  if (!list) return null;
  if (!["queued", "enriching", "stopping", "paused_credits", "paused_upstream"].includes(list.status)) return null;

  const [submitted, pendingBefore] = await Promise.all([countContacts(admin, list.id, "submitted"), countContacts(admin, list.id, "pending")]);

  let pending = pendingBefore;
  if (pending > 0 && list.row_limit && list.status !== "stopping") {
    const upstream = await countUpstreamRows(admin, list.id);
    if (upstream >= list.row_limit) {
      await admin.from("list_contacts").update({ status: "skipped", skip_reason: "row_limit" }).eq("list_id", list.id).eq("status", "pending");
      pending = 0;
    }
  }

  let next: "completed" | "stopped" | null = null;
  if (list.status === "stopping" && submitted === 0) next = "stopped";
  else if ((list.status === "enriching" || list.status === "queued") && submitted === 0 && pending === 0) next = "completed";
  if (!next) return null;

  const { data: updated } = await admin
    .from("lists")
    .update({ status: next, completed_at: new Date().toISOString(), error: null })
    .eq("id", list.id)
    .eq("status", list.status)
    .select("*")
    .maybeSingle();
  if (!updated) return null; // someone else moved it first

  if (next === "stopped") {
    await admin.from("list_contacts").update({ status: "skipped", skip_reason: "stopped" }).eq("list_id", list.id).eq("status", "pending");
  }
  await releaseHolds(admin, list.id);
  log("finalize.list", { listId: list.id, status: next, processed: updated.processed_rows, creditsUsed: updated.credits_used });
  await notifyListFinished(admin, updated, next === "stopped");
  return next;
}

export async function finalizeLists(admin: Admin): Promise<number> {
  const { data: lists } = await admin
    .from("lists")
    .select("id")
    .in("status", ["queued", "enriching", "stopping"])
    .order("updated_at", { ascending: true })
    .limit(50);
  let finalized = 0;
  for (const l of lists ?? []) {
    try {
      if (await finalizeList(admin, l.id)) finalized += 1;
    } catch (error) {
      logError("finalize.failed", error, { listId: l.id });
    }
  }
  return finalized;
}
