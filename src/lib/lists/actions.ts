"use server";

import { createHash } from "node:crypto";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Json, TablesInsert } from "@/lib/supabase/types";
import { EMPTY_MAPPING, type ColumnMapping, type PrebField } from "@/lib/csv/automap";
import { MAX_BYTES, MAX_ROWS, parseSpreadsheet, type FileType } from "@/lib/csv/parse";
import { normaliseRows, type RowSummary } from "@/lib/csv/normalize";
import { estimateCredits, type EnrichmentField } from "@/lib/credits/estimate";
import { cachedContactPatch } from "@/lib/jobs/results";
import { runTick } from "@/lib/jobs/tick";
import type { EnrichmentRecord } from "@/lib/fullenrich/types";

const BUCKET = "list-uploads";
const CACHE_TTL_DAYS = 90;
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
      .eq("source_workspace_id", session.workspace.id)
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
      list_id: list.id,
      workspace_id: session.workspace.id,
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
      return { ...base, ...cachedContactPatch(hit.record, "enrich", now) };
    }
    if (hit && r.skipReason === "email_only" && hit.reverse) {
      // Identified before in this workspace: served free, no opt-in needed.
      cachedReverse += 1;
      return { ...base, skip_reason: null, ...cachedContactPatch(hit.record, "reverse", now) };
    }
    return base;
  });

  // Re-parse is idempotent: replace previous contacts for this draft.
  await admin.from("list_contacts").delete().eq("list_id", list.id);
  for (let i = 0; i < inserts.length; i += INSERT_BATCH) {
    const { error } = await admin.from("list_contacts").insert(inserts.slice(i, i + INSERT_BATCH));
    if (error) {
      console.error(JSON.stringify({ scope: "lists", event: "parse.insert_failed", listId: list.id, error: error.message }));
      return { ok: false, error: "Could not store the rows. Please try again." };
    }
  }

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

/** Step 3: validate, place a credit hold, queue the list and kick the dispatcher. */
export async function startList(listId: string, input: StartListInput): Promise<StartListError | undefined> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (list.status !== "draft") return { error: "This list has already been started." };

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

  revalidatePath("/lists");
  redirect(`/lists/${list.id}`);
}

/* ------------------------------------------------------------ card actions */

export async function renameList(listId: string, name: string): Promise<Result> {
  const { supabase, list } = await loadOwnList(listId);
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: "Name can't be empty." };
  const { error } = await supabase.from("lists").update({ name: clean }).eq("id", list.id);
  if (error) return { ok: false, error: "Could not rename the list." };
  revalidatePath("/lists");
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
  revalidatePath("/lists");
  return { ok: true, data: undefined };
}

/** Hard delete: rows cascade, the original upload is removed from Storage. */
export async function deleteList(listId: string): Promise<Result> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (["queued", "enriching", "stopping"].includes(list.status)) {
    return { ok: false, error: "Stop the list before deleting it." };
  }
  const { error } = await supabase.from("lists").delete().eq("id", list.id);
  if (error) return { ok: false, error: "You don't have permission to delete this list." };
  const admin = createAdminClient();
  await admin.from("credit_holds").update({ released_at: new Date().toISOString() }).eq("list_id", list.id).is("released_at", null);
  const { data: objects } = await admin.storage.from(BUCKET).list(`${session.workspace.id}/${list.id}`);
  if (objects?.length) {
    await admin.storage.from(BUCKET).remove(objects.map((o) => `${session.workspace.id}/${list.id}/${o.name}`));
  }
  revalidatePath("/lists");
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
