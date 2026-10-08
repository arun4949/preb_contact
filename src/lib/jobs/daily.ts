import "server-only";

import { getAccountCredits } from "@/lib/fullenrich/client";
import { CREDIT_MULTIPLIER } from "@/lib/fullenrich/mapping";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyOps } from "./notify";
import { log, logError, releaseHolds } from "./shared";

const BUCKET = "list-uploads";
const WEBHOOK_RETENTION_DAYS = 30;
const DRAFT_RETENTION_HOURS = 24;
/** Alert when the upstream balance is below this many credits… */
const LOW_BALANCE_FLOOR = Number(process.env.UPSTREAM_LOW_BALANCE ?? "200");

export interface DailySummary {
  expiredGrants: number;
  holdsReleased: number;
  draftsDeleted: number;
  webhookEventsDeleted: number;
  upstreamBalance: number | null;
  alerted: boolean;
  errors: string[];
}

/** Housekeeping: expire grants, provider balance alert, cleanup of drafts and old webhook payloads. */
export async function runDaily(): Promise<DailySummary> {
  const admin = createAdminClient();
  const summary: DailySummary = { expiredGrants: 0, holdsReleased: 0, draftsDeleted: 0, webhookEventsDeleted: 0, upstreamBalance: null, alerted: false, errors: [] };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (error) {
      summary.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      logError(`daily.${name}_failed`, error);
    }
  };

  await step("expire_grants", async () => {
    const { data, error } = await admin.rpc("expire_grants");
    if (error) throw new Error(error.message);
    summary.expiredGrants = data ?? 0;
  });

  await step("release_orphan_holds", async () => {
    // Holds on lists that are no longer running (belt and braces).
    const { data } = await admin
      .from("credit_holds")
      .select("list_id, lists!inner(status)")
      .is("released_at", null)
      .in("lists.status", ["draft", "stopped", "completed", "failed"]);
    const ids = [...new Set((data ?? []).map((h) => h.list_id))];
    for (const id of ids) await releaseHolds(admin, id);
    summary.holdsReleased = ids.length;
  });

  await step("upstream_balance", async () => {
    const { balance } = await getAccountCredits();
    summary.upstreamBalance = balance;
    const { data: holds } = await admin.from("credit_holds").select("amount").is("released_at", null).order("amount", { ascending: false }).limit(1);
    // Holds are in Preb credits; the provider balance is in provider credits.
    const largestHold = Math.ceil((holds?.[0]?.amount ?? 0) / CREDIT_MULTIPLIER);
    const threshold = Math.max(LOW_BALANCE_FLOOR, 2 * largestHold);
    if (balance < threshold) {
      summary.alerted = true;
      await notifyOps("Upstream credit balance is low", [
        `balance: ${balance}`,
        `threshold: ${threshold} (floor ${LOW_BALANCE_FLOOR}, 2× largest open hold ${largestHold})`,
        "Top up the provider account before lists start pausing.",
      ]);
    }
  });

  await step("cleanup_drafts", async () => {
    const cutoff = new Date(Date.now() - DRAFT_RETENTION_HOURS * 3_600_000).toISOString();
    const { data: drafts } = await admin.from("lists").select("id, workspace_id").eq("status", "draft").lt("created_at", cutoff).limit(100);
    for (const d of drafts ?? []) {
      const prefix = `${d.workspace_id}/${d.id}`;
      const { data: objects } = await admin.storage.from(BUCKET).list(prefix);
      if (objects?.length) await admin.storage.from(BUCKET).remove(objects.map((o) => `${prefix}/${o.name}`));
      await admin.from("lists").delete().eq("id", d.id);
      summary.draftsDeleted += 1;
    }
  });

  await step("cleanup_webhook_events", async () => {
    const cutoff = new Date(Date.now() - WEBHOOK_RETENTION_DAYS * 86_400_000).toISOString();
    const { count } = await admin.from("webhook_events").delete({ count: "exact" }).lt("received_at", cutoff).not("processed_at", "is", null);
    summary.webhookEventsDeleted = count ?? 0;
  });

  log("daily.done", { ...summary });
  return summary;
}
