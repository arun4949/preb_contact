"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Json, Tables, TablesInsert } from "@/lib/supabase/types";
import { EMPTY_MAPPING, type ColumnMapping, type PrebField } from "@/lib/csv/automap";
import { MAX_BYTES, MAX_ROWS, parseSpreadsheet, type FileType } from "@/lib/csv/parse";
import { normaliseRows, type NormalisedRow, type RowSummary } from "@/lib/csv/normalize";
import { estimateCredits, type EnrichmentField } from "@/lib/credits/estimate";
import { MANUAL_HEADERS, MANUAL_MAPPING, MANUAL_MAX_CONTACTS, manualListName, type ManualEnrichmentInput, type ManualEnrichmentResult } from "@/lib/lists/manual";
import { cachedContactPatch } from "@/lib/jobs/results";
import { profileName } from "@/lib/fullenrich/mapping";
import { CACHE_TTL_DAYS } from "@/lib/jobs/shared";
import { runTick } from "@/lib/jobs/tick";
import type { EnrichmentRecord } from "@/lib/fullenrich/types";

const BUCKET = "list-uploads";
const INSERT_BATCH = 1000;

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireSession() {
  const session = await getSessionContext();
  if (!session) throw new Error("Not signed in");
  return session;
}

/** Loads a list the caller can see (RLS) and checks it belongs to the current workspace. */
async function loadOwnList(listId: string) {
  const session = await requireSession();
  const supabase = await createClient();
  const { data: list } = await supabase.from("lists").select("*").eq("id", listId).maybeSingle();
  if (!list || list.workspace_id !== session.workspace.id) throw new Error("List not found");
  return { session, supabase, list };
}

/* ----------------------------------------------------------------- upload */

export interface DraftUpload {
  listId: string;
  path: string;
  /** Signed PUT target for the browser (valid 2 h). */
  signedUrl: string;
}

/**
 * Step 1: create a draft list and a signed upload URL for the original file.
 * The browser PUTs the file (with progress) and then calls `attachUpload`.
 */
export async function createDraftList(fileName: string, fileSize: number): Promise<Result<DraftUpload>> {
  const session = await requireSession();
  const ext = fileName.split(".").pop()?.toLowerCase();
  const type: FileType | null = ext === "csv" || ext === "txt" || ext === "tsv" ? "csv" : ext === "xlsx" || ext === "xls" ? "xlsx" : null;
  if (!type) return { ok: false, error: "Only CSV and XLSX files are supported." };
  if (fileSize > MAX_BYTES) return { ok: false, error: "Files are limited to 20 MB." };

  const supabase = await createClient();
  const { data: list, error } = await supabase
    .from("lists")
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.userId,
      name: fileName.replace(/\.[^.]+$/, "").slice(0, 120) || "Untitled list",
      status: "draft",
      file_type: type,
      file_name: fileName,
    })
    .select("id")
    .single();
  if (error || !list) return { ok: false, error: "Could not create the list. Please try again." };

  const path = `${session.workspace.id}/${list.id}/original.${type}`;
  const admin = createAdminClient();
  const { data: signed, error: signErr } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (signErr || !signed) return { ok: false, error: "Could not prepare the upload. Please try again." };

  return { ok: true, data: { listId: list.id, path, signedUrl: signed.signedUrl } };
}

/** Confirms the upload landed and stores the storage path on the draft. */
export async function attachUpload(listId: string, path: string): Promise<Result> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (!path.startsWith(`${session.workspace.id}/${list.id}/`)) return { ok: false, error: "Invalid upload path." };
  const admin = createAdminClient();
  const { data: head } = await admin.storage.from(BUCKET).list(`${session.workspace.id}/${list.id}`);
  if (!head?.some((o) => `${session.workspace.id}/${list.id}/${o.name}` === path)) {
    return { ok: false, error: "The uploaded file could not be found. Please try again." };
  }
  const { error } = await supabase.from("lists").update({ file_path: path }).eq("id", listId);
  return error ? { ok: false, error: "Could not save the upload." } : { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ parse */

export interface ParseSummary extends RowSummary {
  /** Enrichable rows already enriched in this workspace in the last 90 days (free). */
  cached: number;
  /** Email-only rows already identified in this workspace in the last 90 days (free; not counted in `emailOnly`). */
  cachedReverse: number;
  truncated: boolean;
}

function inputHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Drop the workspace's cached results for these inputs (chunked: PostgREST URL length). */
async function purgeCacheRows(admin: ReturnType<typeof createAdminClient>, workspaceId: string, hashes: readonly string[]): Promise<void> {
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
async function insertContacts(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  listId: string,
  rows: NormalisedRow[],
): Promise<Result<{ cached: number; cachedReverse: number }>> {
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

  let cached = 0;
  let cachedReverse = 0;
  const now = new Date().toISOString();
  const inserts: TablesInsert<"list_contacts">[] = rows.map((r) => {
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

  // Re-parse is idempotent: replace previous contacts for this draft.
  await admin.from("list_contacts").delete().eq("list_id", listId);
  for (let i = 0; i < inserts.length; i += INSERT_BATCH) {
    const { error } = await admin.from("list_contacts").insert(inserts.slice(i, i + INSERT_BATCH));
    if (error) {
      console.error(JSON.stringify({ scope: "lists", event: "parse.insert_failed", listId: listId, error: error.message }));
      return { ok: false, error: "Could not store the rows. Please try again." };
    }
  }

  return { ok: true, data: { cached, cachedReverse } };
}

/**
 * Step 2 → 3: parse the stored file with the chosen mapping, normalise,
 * dedup, look up the cache and (re)write `list_contacts`. Idempotent.
 */
export async function parseList(listId: string, mapping: ColumnMapping, hasHeader: boolean): Promise<Result<ParseSummary>> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (!list.file_path || !list.file_type) return { ok: false, error: "Upload a file first." };
  if (list.status !== "draft") return { ok: false, error: "This list has already been started." };

  const admin = createAdminClient();
  const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(list.file_path);
  if (dlErr || !blob) return { ok: false, error: "Could not read the uploaded file." };

  const sheet = parseSpreadsheet(list.file_type as FileType, await blob.arrayBuffer(), hasHeader);
  if (sheet.rows.length === 0) return { ok: false, error: "The file has no data rows." };

  const safeMapping: ColumnMapping = { ...EMPTY_MAPPING };
  for (const key of Object.keys(EMPTY_MAPPING) as PrebField[]) {
    const idx = mapping[key];
    safeMapping[key] = typeof idx === "number" && idx >= 0 && idx < sheet.headers.length ? idx : null;
  }

  const { rows, summary } = normaliseRows(sheet.rows, sheet.headers, safeMapping);
  if (summary.enrichable === 0 && summary.emailOnly === 0) {
    return { ok: false, error: "No row has enough information to enrich. Check the mapping." };
  }

  const inserted = await insertContacts(admin, session.workspace.id, list.id, rows);
  if (!inserted.ok) return inserted;
  const { cached, cachedReverse } = inserted.data;

  const { error: updErr } = await supabase
    .from("lists")
    .update({
      column_mapping: { ...safeMapping, headers: sheet.headers } as Json,
      has_header: hasHeader,
      duplicates_removed: summary.duplicates,
    })
    .eq("id", list.id);
  if (updErr) return { ok: false, error: "Could not save the mapping." };

  return { ok: true, data: { ...summary, emailOnly: summary.emailOnly - cachedReverse, cached, cachedReverse, truncated: sheet.truncated } };
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
 * Shared by `startList` (file wizard) and `startManualEnrichment`.
 */
async function queueList(
  session: Awaited<ReturnType<typeof requireSession>>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  list: Tables<"lists">,
  input: StartListInput,
): Promise<StartListError | undefined> {
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

  const { data: available } = await supabase.rpc("credits_available", { ws: session.workspace.id });
  const balance = available ?? 0;
  if (balance < estimate.typical) {
    return { error: "Not enough credits to start this list.", shortBy: estimate.typical - balance };
  }

  const admin = createAdminClient();
  if (estimate.typical > 0) {
    const { error: holdErr } = await admin
      .from("credit_holds")
      .insert({ workspace_id: session.workspace.id, list_id: list.id, amount: estimate.typical });
    if (holdErr) return { error: "Could not reserve credits. Please try again." };
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

/** Step 3: validate, place a credit hold, queue the list and kick the dispatcher. */
export async function startList(listId: string, input: StartListInput): Promise<StartListError | undefined> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (list.status !== "draft") return { error: "This list has already been started." };

  const queued = await queueList(session, supabase, list, input);
  if (queued) return queued;

  // Layout scope: the dashboard and every /lists/[id] page re-render from the action response.
  revalidatePath("/lists", "layout");
  redirect(`/lists/${list.id}`);
}

/* ------------------------------------------------------------ card actions */

export async function renameList(listId: string, name: string): Promise<Result> {
  const { supabase, list } = await loadOwnList(listId);
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Name can't be empty." };
  const { error } = await supabase.from("lists").update({ name: clean }).eq("id", list.id);
  if (error) return { ok: false, error: "Could not rename the list." };
  // Layout scope: the dashboard and every /lists/[id] page re-render from the action response.
  revalidatePath("/lists", "layout");
  return { ok: true, data: undefined };
}

/** Stop: no new submissions; in-flight batches finish and are charged (engine, day 3). */
export async function stopList(listId: string): Promise<Result> {
  const { supabase, list } = await loadOwnList(listId);
  if (!["queued", "enriching", "paused_credits", "paused_upstream"].includes(list.status)) {
    return { ok: false, error: "This list isn't running." };
  }
  const next = list.status === "queued" ? "stopped" : "stopping";
  const { error } = await supabase.from("lists").update({ status: next }).eq("id", list.id);
  if (error) return { ok: false, error: "Could not stop the list." };
  if (next === "stopped") {
    const admin = createAdminClient();
    await admin.from("list_contacts").update({ status: "skipped", skip_reason: "stopped" }).eq("list_id", list.id).eq("status", "pending");
    await admin.from("credit_holds").update({ released_at: new Date().toISOString() }).eq("list_id", list.id).is("released_at", null);
  }
  // Layout scope: the dashboard and every /lists/[id] page re-render from the action response.
  revalidatePath("/lists", "layout");
  return { ok: true, data: undefined };
}

/**
 * Hard delete: rows cascade, the original upload is removed from Storage and
 * the workspace's cached results for the list's contacts are dropped too
 * (privacy policy § 8: "or earlier when the related list is deleted").
 */
export async function deleteList(listId: string): Promise<Result> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (["queued", "enriching", "stopping"].includes(list.status)) {
    return { ok: false, error: "Stop the list before deleting it." };
  }
  const admin = createAdminClient();
  // Hashes must be read before the delete: list_contacts cascades away with the list.
  const { data: hashRows } = await admin.from("list_contacts").select("input_hash").eq("list_id", list.id).not("input_hash", "is", null);
  const { error } = await supabase.from("lists").delete().eq("id", list.id);
  if (error) return { ok: false, error: "You don't have permission to delete this list." };
  await purgeCacheRows(admin, session.workspace.id, (hashRows ?? []).map((r) => r.input_hash!));
  const { data: objects } = await admin.storage.from(BUCKET).list(`${session.workspace.id}/${list.id}`);
  if (objects?.length) {
    await admin.storage.from(BUCKET).remove(objects.map((o) => `${session.workspace.id}/${list.id}/${o.name}`));
  }
  // Layout scope: the dashboard and every /lists/[id] page re-render from the action response.
  revalidatePath("/lists", "layout");
  return { ok: true, data: undefined };
}

/** Abandoned wizard: drop the draft and its upload. */
export async function discardDraft(listId: string): Promise<void> {
  try {
    const { list } = await loadOwnList(listId);
    if (list.status === "draft") await deleteList(listId);
  } catch {
    // Nothing to discard.
  }
}

/* ----------------------------------------------------------------- manual */

/**
 * Enrich tab: hand-typed contacts (LinkedIn URL, or first + last + domain)
 * become a hidden `source = 'manual'` list that runs through the normal
 * engine. Returns without redirecting; the page shows the rows as history.
 */
export async function startManualEnrichment(input: ManualEnrichmentInput): Promise<ManualEnrichmentResult> {
  const session = await requireSession();
  const supabase = await createClient();

  const clean = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
  const contacts = (Array.isArray(input.contacts) ? input.contacts : []).slice(0, MANUAL_MAX_CONTACTS);
  const cells = contacts.map((c) => [clean(c.first_name), clean(c.last_name), clean(c.domain), clean(c.linkedin_url)]);
  const allowed: EnrichmentField[] = ["work_email", "personal_email", "mobile_phone"];
  const fields = allowed.filter((f) => input.fields.includes(f));
  if (fields.length === 0) return { ok: false, error: "Choose at least one thing to find." };

  const { rows, summary } = normaliseRows(cells, MANUAL_HEADERS, MANUAL_MAPPING);
  if (summary.enrichable === 0) {
    return { ok: false, error: "Add at least one contact with a LinkedIn URL, or first name, last name and company domain." };
  }

  const name = manualListName(rows);
  const { data: list, error: insErr } = await supabase
    .from("lists")
    .insert({
      workspace_id: session.workspace.id,
      created_by: session.userId,
      name,
      status: "draft",
      source: "manual",
      column_mapping: { ...MANUAL_MAPPING, headers: MANUAL_HEADERS } as Json,
      has_header: true,
      duplicates_removed: summary.duplicates,
    })
    .select("*")
    .single();
  if (insErr || !list) return { ok: false, error: "Could not start the enrichment. Please try again." };

  const admin = createAdminClient();
  const fail = async (error: string, shortBy?: number): Promise<ManualEnrichmentResult> => {
    await admin.from("lists").delete().eq("id", list.id);
    return { ok: false, error, shortBy };
  };

  const inserted = await insertContacts(admin, session.workspace.id, list.id, rows);
  if (!inserted.ok) return fail(inserted.error);

  const queued = await queueList(session, supabase, list, { name, fields, rowLimit: null });
  if (queued) return fail(queued.error, queued.shortBy);

  revalidatePath("/enrich");
  return { ok: true, listId: list.id };
}
