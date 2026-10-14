import "server-only";

import { createHash } from "node:crypto";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables, TablesInsert } from "@/lib/supabase/types";
import { MAX_ROWS } from "@/lib/csv/parse";
import type { NormalisedRow } from "@/lib/csv/normalize";
import { estimateCredits, type EnrichmentField } from "@/lib/credits/estimate";
import { cachedContactPatch } from "@/lib/jobs/results";
import { profileName } from "@/lib/fullenrich/mapping";
import { CACHE_TTL_DAYS } from "@/lib/jobs/shared";
import { hashesOf, inputIdentifiers, recordIdentifiers, type Identifier } from "@/lib/suppression/identifiers";
import { scrubRaw, SUPPRESSED_PATCH, suppressedHashes } from "@/lib/suppression/check";
import { runTick } from "@/lib/jobs/tick";
import type { EnrichmentRecord } from "@/lib/fullenrich/types";

/**
 * Shared list-building steps used by the wizard, the Enrich tab and the lead
 * magnet admin: cache lookup + `list_contacts` insert, and the queue step
 * (estimate, hold, status → queued, engine kick). Kept out of the "use server"
 * actions file so nothing here is callable from the client.
 */

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Either the RLS session client or the service-role client. */
export type DbClient = SupabaseClient<Database>;

export const INSERT_BATCH = 1000;

export function inputHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Drop the workspace's cached results for these inputs (chunked: PostgREST URL length). */
export async function purgeCacheRows(admin: ReturnType<typeof createAdminClient>, workspaceId: string, hashes: readonly string[]): Promise<void> {
  const unique = [...new Set(hashes)];
  for (let i = 0; i < unique.length; i += 500) {
    await admin.from("enrichment_cache").delete().eq("workspace_id", workspaceId).in("input_hash", unique.slice(i, i + 500));
  }
}

/**
 * Cache lookup (same workspace, < 90 days) and the `list_contacts` insert,
 * shared by the file wizard and manual entry. Replaces any previous rows of
 * the list, so a re-parse is idempotent.
 */
export async function insertContacts(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  listId: string,
  rows: NormalisedRow[],
): Promise<Result<{ cached: number; cachedReverse: number; suppressedEnrich: number; suppressedEmailOnly: number }>> {
  // Cache lookup (same workspace, < 90 days) → free, pre-filled rows. Enrichable
  // rows reuse enrich records; email-only rows reuse reverse-lookup records
  // (cached under the "reverse" field tag), so a repeat email list costs nothing.
  const hashes = new Map<string, string>();
  for (const r of rows) if ((r.enrichable || r.skipReason === "email_only") && r.dedupKey) hashes.set(r.dedupKey, inputHash(r.dedupKey));
  const since = new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString();
  const cacheHits = new Map<string, { record: EnrichmentRecord; reverse: boolean }>();
  const hashList = [...hashes.values()];
  for (let i = 0; i < hashList.length; i += INSERT_BATCH) {
    const { data } = await admin
      .from("enrichment_cache")
      .select("input_hash, fields, result")
      .in("input_hash", hashList.slice(i, i + INSERT_BATCH))
      .eq("workspace_id", workspaceId)
      .gte("fetched_at", since);
    for (const hit of data ?? []) {
      cacheHits.set(hit.input_hash, { record: hit.result as unknown as EnrichmentRecord, reverse: hit.fields.includes("reverse") });
    }
  }

  // Suppression list (privacy policy § 12): people who objected are never
  // enriched again. A cache hit is checked on its output too (the emails and
  // phones the stored record would reveal), not only on what the row gave us.
  const idsByRow = new Map<number, Identifier[]>();
  const idsByHit = new Map<string, Identifier[]>();
  for (const r of rows) {
    const ids = inputIdentifiers(r);
    const hash = r.dedupKey ? hashes.get(r.dedupKey) : undefined;
    const hit = hash ? cacheHits.get(hash) : undefined;
    if (hit && hash && !idsByHit.has(hash)) idsByHit.set(hash, recordIdentifiers(hit.record));
    const all = hit && hash ? [...ids, ...(idsByHit.get(hash) ?? [])] : ids;
    if (all.length) idsByRow.set(r.rowIndex, all);
  }
  const suppressed = idsByRow.size ? await suppressedHashes(admin, [...idsByRow.values()].flatMap(hashesOf)) : new Set<string>();
  const purgeHashes: string[] = [];

  let cached = 0;
  let cachedReverse = 0;
  let suppressedEnrich = 0;
  let suppressedEmailOnly = 0;
  const now = new Date().toISOString();
  const inserts: TablesInsert<"list_contacts">[] = rows.map((r) => {
    const ids = idsByRow.get(r.rowIndex) ?? [];
    const hits = ids.filter((i) => suppressed.has(hashesOf([i])[0]));
    if (hits.length) {
      if (r.enrichable) suppressedEnrich += 1;
      else if (r.skipReason === "email_only") suppressedEmailOnly += 1;
      // A cached record that names a suppressed person must not be served again.
      const hitHash = r.dedupKey ? hashes.get(r.dedupKey) : undefined;
      if (hitHash && cacheHits.has(hitHash)) purgeHashes.push(hitHash);
      return {
        list_id: listId,
        workspace_id: workspaceId,
        row_index: r.rowIndex,
        raw: scrubRaw(r.raw, hits.map((h) => h.value)) as Json,
        first_name: r.first_name,
        last_name: r.last_name,
        full_name: r.full_name,
        company_name: r.company_name,
        domain: r.domain,
        kind: "enrich",
        credits_cost: 0,
        ...SUPPRESSED_PATCH,
      };
    }
    const hash = r.dedupKey ? hashes.get(r.dedupKey) ?? inputHash(r.dedupKey) : null;
    const base: TablesInsert<"list_contacts"> = {
      list_id: listId,
      workspace_id: workspaceId,
      row_index: r.rowIndex,
      raw: r.raw as Json,
      first_name: r.first_name,
      last_name: r.last_name,
      full_name: r.full_name,
      company_name: r.company_name,
      domain: r.domain,
      linkedin_url: r.linkedin_url,
      email_input: r.email_input,
      input_hash: hash,
      status: r.enrichable ? "pending" : "skipped",
      skip_reason: r.skipReason,
      // Email-only rows wait as skipped until the user opts into reverse lookup in step 3.
      kind: r.skipReason === "email_only" ? "reverse" : "enrich",
      // Explicit: a bulk insert that mixes cache-hit rows (which set this) with
      // plain rows would otherwise send NULL for the missing key, not the default.
      credits_cost: 0,
    };
    const hit = hash ? cacheHits.get(hash) : undefined;
    if (hit && r.enrichable && !hit.reverse) {
      cached += 1;
      // LinkedIn-only rows have no name of their own: take it from the cached profile.
      const name = !r.full_name && !r.first_name && !r.last_name ? profileName(hit.record) : null;
      return { ...base, ...cachedContactPatch(hit.record, "enrich", now), ...(name ?? {}) };
    }
    if (hit && r.skipReason === "email_only" && hit.reverse) {
      // Identified before in this workspace: served free, no opt-in needed.
      cachedReverse += 1;
      return { ...base, skip_reason: null, ...cachedContactPatch(hit.record, "reverse", now) };
    }
    return base;
  });

  if (purgeHashes.length) await purgeCacheRows(admin, workspaceId, purgeHashes);

  // Re-parse is idempotent: replace previous contacts for this draft.
  await admin.from("list_contacts").delete().eq("list_id", listId);
  for (let i = 0; i < inserts.length; i += INSERT_BATCH) {
    const { error } = await admin.from("list_contacts").insert(inserts.slice(i, i + INSERT_BATCH));
    if (error) {
      console.error(JSON.stringify({ scope: "lists", event: "parse.insert_failed", listId: listId, error: error.message }));
      return { ok: false, error: "Could not store the rows. Please try again." };
    }
  }

  return { ok: true, data: { cached, cachedReverse, suppressedEnrich, suppressedEmailOnly } };
}

/* ------------------------------------------------------------------ start */

export interface StartListInput {
  name: string;
  fields: EnrichmentField[];
  /** Max rows to enrich (undefined = all enrichable rows). */
  rowLimit?: number | null;
  /** Identify email-only rows via reverse email lookup (1 credit each when found). */
  reverseLookup?: boolean;
}

export interface StartListError {
  error: string;
  /** Set when the workspace is short on credits: how many more are needed. */
  shortBy?: number;
}

/**
 * Validate, place a credit hold, queue the list and kick the dispatcher.
 * Shared by `startList` (file wizard), `startManualEnrichment` and the lead
 * magnet admin (`skipCredits`).
 */
export interface QueueListOptions {
  client: DbClient;
  workspaceId: string;
  list: Tables<"lists">;
  input: StartListInput;
  /** Internal (Preb outreach) workspaces: no balance check, no hold. The estimate is still stored. */
  skipCredits?: boolean;
}

export async function queueList({ client: supabase, workspaceId, list, input, skipCredits = false }: QueueListOptions): Promise<StartListError | undefined> {
  const name = input.name.trim().slice(0, 120);
  if (!name) return { error: "Give the list a name." };
  const allowed: EnrichmentField[] = ["work_email", "personal_email", "mobile_phone"];
  const fields = allowed.filter((f) => input.fields.includes(f));

  const [{ count: pendingCount }, { count: emailOnlyCount }, { count: cachedCount }] = await Promise.all([
    supabase.from("list_contacts").select("id", { count: "exact", head: true }).eq("list_id", list.id).eq("status", "pending"),
    supabase.from("list_contacts").select("id", { count: "exact", head: true }).eq("list_id", list.id).eq("status", "skipped").eq("skip_reason", "email_only"),
    supabase.from("list_contacts").select("id", { count: "exact", head: true }).eq("list_id", list.id).eq("status", "cached"),
  ]);
  const pending = pendingCount ?? 0;
  const reverseRows = input.reverseLookup ? emailOnlyCount ?? 0 : 0;
  if (pending > 0 && fields.length === 0) return { error: "Choose at least one thing to find." };
  // A list served entirely from the cache has nothing to send; the tick completes it.
  if (pending === 0 && reverseRows === 0 && (cachedCount ?? 0) === 0) return { error: "There is nothing to enrich in this list." };

  const rowLimit = input.rowLimit && input.rowLimit > 0 ? Math.min(Math.floor(input.rowLimit), MAX_ROWS) : null;
  // The dispatcher sends enrich rows first, then email-only rows; the limit spans both.
  const rows = rowLimit ? Math.min(rowLimit, pending) : pending;
  const reverseWithinLimit = rowLimit ? Math.max(0, Math.min(reverseRows, rowLimit - rows)) : reverseRows;
  const estimate = estimateCredits(rows, fields, reverseWithinLimit);

  const admin = createAdminClient();
  if (!skipCredits) {
    const { data: available } = await supabase.rpc("credits_available", { ws: workspaceId });
    const balance = available ?? 0;
    if (balance < estimate.typical) {
      return { error: "Not enough credits to start this list.", shortBy: estimate.typical - balance };
    }
    if (estimate.typical > 0) {
      const { error: holdErr } = await admin
        .from("credit_holds")
        .insert({ workspace_id: workspaceId, list_id: list.id, amount: estimate.typical });
      if (holdErr) return { error: "Could not reserve credits. Please try again." };
    }
  }

  if (reverseRows > 0) {
    // Opt-in: email-only rows join the queue as reverse-lookup contacts.
    const { error: flipErr } = await admin
      .from("list_contacts")
      .update({ status: "pending", skip_reason: null, kind: "reverse" })
      .eq("list_id", list.id)
      .eq("status", "skipped")
      .eq("skip_reason", "email_only");
    if (flipErr) {
      await admin.from("credit_holds").update({ released_at: new Date().toISOString() }).eq("list_id", list.id).is("released_at", null);
      return { error: "Could not queue the email-only rows. Please try again." };
    }
  }

  const { error: updErr } = await supabase
    .from("lists")
    .update({
      name,
      enrich_fields: fields,
      reverse_lookup: reverseRows > 0,
      mode: pending === 0 && reverseRows > 0 ? "reverse" : "enrich",
      row_limit: rowLimit,
      credits_estimated: estimate.typical,
      credits_max: estimate.max,
      status: "queued",
      started_at: new Date().toISOString(),
    })
    .eq("id", list.id);
  if (updErr) {
    await admin.from("credit_holds").update({ released_at: new Date().toISOString() }).eq("list_id", list.id).is("released_at", null);
    return { error: "Could not start the list. Please try again." };
  }

  // Kick the engine right away (in-process, no network hop); the 1-minute
  // cron is the safety net if this pass fails or the list is not picked up.
  after(async () => {
    try {
      await runTick();
    } catch {
      // The cron tick picks the list up within a minute.
    }
  });

}
