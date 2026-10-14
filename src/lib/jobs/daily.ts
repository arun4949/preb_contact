import "server-only";

import { getAccountCredits } from "@/lib/fullenrich/client";
import { CREDIT_MULTIPLIER } from "@/lib/fullenrich/mapping";
import { createAdminClient } from "@/lib/supabase/admin";
import { creditsExpiringCopy } from "@/lib/notifications/copy";
import { notifyWorkspace } from "@/lib/notifications/emit";
import { notifyOps } from "./notify";
import { LEAD_SHARE_RETENTION_MONTHS } from "@/lib/leads/constants";
import { purgeCacheRows } from "@/lib/lists/insert-contacts";
import { CACHE_TTL_DAYS, log, logError, releaseHolds } from "./shared";

const BUCKET = "list-uploads";
const WEBHOOK_RETENTION_DAYS = 30;
const DRAFT_RETENTION_HOURS = 24;
/** Owners/admins are told this many days before a grant (or the trial) expires. */
const EXPIRY_WARNING_DAYS = 7;
/** Notifications older than this are deleted. */
const NOTIFICATION_RETENTION_DAYS = 90;
/** Tombstones of deleted accounts (trial guard) are kept this long (privacy policy § 8). */
const DELETED_ACCOUNT_RETENTION_MONTHS = 12;
/** The email send log (rate limits, delivery proof) is kept this long (privacy policy § 8). */
const EMAIL_LOG_RETENTION_MONTHS = 12;
/** Unconfirmed opt-out requests are kept this long after the link expired, so the link can still say "expired". */
const OPT_OUT_PENDING_GRACE_DAYS = 7;
/** Confirmed opt-out requests are the record of the request (page "Your data and Preb"). */
const OPT_OUT_RECORD_RETENTION_YEARS = 3;
/** Opt-out emails in the send log carry the requester's raw address; the hourly cap only needs the last hour. */
const OPT_OUT_EMAIL_LOG_DAYS = 7;
/** Alert when the upstream balance is below this many credits… */
const LOW_BALANCE_FLOOR = Number(process.env.UPSTREAM_LOW_BALANCE ?? "200");

export interface DailySummary {
  expiredGrants: number;
  holdsReleased: number;
  draftsDeleted: number;
  webhookEventsDeleted: number;
  expiryWarnings: number;
  notificationsDeleted: number;
  cacheRowsDeleted: number;
  tombstonesDeleted: number;
  emailLogDeleted: number;
  optOutPurged: number;
  leadSharesDeleted: number;
  upstreamBalance: number | null;
  alerted: boolean;
  errors: string[];
}

/** Housekeeping: expire grants, provider balance alert, cleanup of drafts, cache rows, tombstones, opt-out requests and old webhook payloads. */
export async function runDaily(): Promise<DailySummary> {
  const admin = createAdminClient();
  const summary: DailySummary = { expiredGrants: 0, holdsReleased: 0, draftsDeleted: 0, webhookEventsDeleted: 0, expiryWarnings: 0, notificationsDeleted: 0, cacheRowsDeleted: 0, tombstonesDeleted: 0, emailLogDeleted: 0, optOutPurged: 0, leadSharesDeleted: 0, upstreamBalance: null, alerted: false, errors: [] };
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

  await step("expiring_grants", async () => {
    // One in-app warning per grant (dedupe key), 7 days ahead; the trial grant gets trial copy.
    const now = Date.now();
    const until = new Date(now + EXPIRY_WARNING_DAYS * 86_400_000).toISOString();
    const { data: grants } = await admin
      .from("credit_grants")
      .select("id, workspace_id, remaining, expires_at, source")
      .gt("remaining", 0)
      .gt("expires_at", new Date(now).toISOString())
      .lte("expires_at", until)
      .limit(500);
    for (const g of grants ?? []) {
      const days = Math.max(0, Math.ceil((new Date(g.expires_at).getTime() - now) / 86_400_000));
      const written = await notifyWorkspace(
        admin,
        g.workspace_id,
        creditsExpiringCopy({ amount: g.remaining, expiresAt: g.expires_at, days, trial: g.source === "trial" }),
        { roles: ["owner", "admin"], dedupeKey: `expiring:${g.id}` },
      );
      summary.expiryWarnings += written;
    }
  });

  await step("cleanup_notifications", async () => {
    const cutoff = new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 86_400_000).toISOString();
    const { count } = await admin.from("notifications").delete({ count: "exact" }).lt("created_at", cutoff);
    summary.notificationsDeleted = count ?? 0;
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

  await step("cleanup_enrichment_cache", async () => {
    // Per-workspace cache rows expire 90 days after the enrichment (privacy policy § 8).
    const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
    const { count, error } = await admin.from("enrichment_cache").delete({ count: "exact" }).lt("fetched_at", cutoff);
    if (error) throw new Error(error.message);
    summary.cacheRowsDeleted = count ?? 0;
  });

  await step("cleanup_deleted_accounts", async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - DELETED_ACCOUNT_RETENTION_MONTHS);
    const { count, error } = await admin.from("deleted_accounts").delete({ count: "exact" }).lt("deleted_at", cutoff.toISOString());
    if (error) throw new Error(error.message);
    summary.tombstonesDeleted = count ?? 0;
  });

  await step("cleanup_email_sends", async () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - EMAIL_LOG_RETENTION_MONTHS);
    const { count, error } = await admin.from("email_sends").delete({ count: "exact" }).lt("sent_at", cutoff.toISOString());
    if (error) throw new Error(error.message);
    summary.emailLogDeleted = count ?? 0;
  });

  await step("cleanup_opt_out", async () => {
    const now = new Date();
    const iso = now.toISOString();
    // Links past their 24 hours: drop the raw address at once, keep the row a week so the link reads "expired".
    const { error: expireErr } = await admin.from("opt_out_requests").update({ status: "expired", email: null }).eq("status", "pending").lt("expires_at", iso);
    if (expireErr) throw new Error(expireErr.message);
    const graceCutoff = new Date(now.getTime() - OPT_OUT_PENDING_GRACE_DAYS * 86_400_000).toISOString();
    const { count: expired, error: expiredErr } = await admin.from("opt_out_requests").delete({ count: "exact" }).eq("status", "expired").lt("expires_at", graceCutoff);
    if (expiredErr) throw new Error(expiredErr.message);
    const recordCutoff = new Date(now);
    recordCutoff.setFullYear(recordCutoff.getFullYear() - OPT_OUT_RECORD_RETENTION_YEARS);
    const { count: old, error: oldErr } = await admin.from("opt_out_requests").delete({ count: "exact" }).eq("status", "confirmed").lt("created_at", recordCutoff.toISOString());
    if (oldErr) throw new Error(oldErr.message);
    const logCutoff = new Date(now.getTime() - OPT_OUT_EMAIL_LOG_DAYS * 86_400_000).toISOString();
    const { error: logErr } = await admin.from("email_sends").delete().in("kind", ["opt_out_verify", "opt_out_done"]).lt("sent_at", logCutoff);
    if (logErr) throw new Error(logErr.message);
    summary.optOutPurged = (expired ?? 0) + (old ?? 0);
  });

  await step("cleanup_lead_shares", async () => {
    // Lead magnet samples: gone 12 months after the last activity (privacy policy, "Sample enrichments and prospects").
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - LEAD_SHARE_RETENTION_MONTHS);
    const iso = cutoff.toISOString();
    const { data: stale } = await admin
      .from("lead_shares")
      .select("id, list_id, workspace_id")
      .lt("created_at", iso)
      .or(`last_seen_at.is.null,last_seen_at.lt.${iso}`)
      .limit(100);
    for (const s of stale ?? []) {
      const { data: hashRows } = await admin.from("list_contacts").select("input_hash").eq("list_id", s.list_id).not("input_hash", "is", null);
      await admin.from("lists").delete().eq("id", s.list_id);
      await purgeCacheRows(admin, s.workspace_id, (hashRows ?? []).map((r) => r.input_hash!));
      await admin.from("lead_shares").delete().eq("id", s.id);
      summary.leadSharesDeleted += 1;
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
