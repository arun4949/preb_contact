"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { workspaceOverspendState } from "@/lib/billing/overspend";
import { runTick } from "@/lib/jobs/tick";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Json } from "@/lib/supabase/types";
import { EMPTY_MAPPING, type ColumnMapping, type PrebField } from "@/lib/csv/automap";
import { MAX_BYTES, parseSpreadsheet, type FileType } from "@/lib/csv/parse";
import { normaliseRows, type RowSummary } from "@/lib/csv/normalize";
import type { EnrichmentField } from "@/lib/credits/estimate";
import { MANUAL_HEADERS, MANUAL_MAPPING, MANUAL_MAX_CONTACTS, manualListName, type ManualEnrichmentInput, type ManualEnrichmentResult } from "@/lib/lists/manual";

import { insertContacts, purgeCacheRows, queueList, type Result, type StartListError, type StartListInput } from "./insert-contacts";

const BUCKET = "list-uploads";

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
  /** Rows of people on the suppression list (privacy policy § 12): stored as skipped, never enriched. */
  suppressed: number;
  truncated: boolean;
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
  const { cached, cachedReverse, suppressedEnrich, suppressedEmailOnly } = inserted.data;

  const { error: updErr } = await supabase
    .from("lists")
    .update({
      column_mapping: { ...safeMapping, headers: sheet.headers } as Json,
      has_header: hasHeader,
      duplicates_removed: summary.duplicates,
    })
    .eq("id", list.id);
  if (updErr) return { ok: false, error: "Could not save the mapping." };

  return {
    ok: true,
    data: {
      ...summary,
      enrichable: summary.enrichable - suppressedEnrich,
      emailOnly: summary.emailOnly - cachedReverse - suppressedEmailOnly,
      cached,
      cachedReverse,
      suppressed: suppressedEnrich + suppressedEmailOnly,
      truncated: sheet.truncated,
    },
  };
}


/** Step 3: validate, place a credit hold, queue the list and kick the dispatcher. */
export async function startList(listId: string, input: StartListInput): Promise<StartListError | undefined> {
  const { session, supabase, list } = await loadOwnList(listId);
  if (list.status !== "draft") return { error: "This list has already been started." };

  const queued = await queueList({ client: supabase, workspaceId: session.workspace.id, list, input });
  if (queued) return queued;

  // Layout scope: the dashboard and every /lists/[id] page re-render from the action response.
  revalidatePath("/lists", "layout");
  redirect(`/lists/${list.id}`);
}

/**
 * A list paused for credits may continue beyond the balance once the
 * workspace has overspend on (the Configure switch happened before the opt-in,
 * or the list opted out). Owners and admins only, since it authorises charges.
 */
export async function allowListOverspend(listId: string): Promise<Result> {
  const { session, list } = await loadOwnList(listId);
  if (session.role === "member") return { ok: false, error: "Only owners and admins can allow overspend." };
  if (!["queued", "enriching", "paused_credits"].includes(list.status)) return { ok: false, error: "This list isn't running." };
  const admin = createAdminClient();
  const state = await workspaceOverspendState(admin, session.workspace.id);
  if (!state?.active) return { ok: false, error: "Turn on overspend under Settings, Billing first." };
  const { error } = await admin.from("lists").update({ overspend_allowed: true }).eq("id", list.id);
  if (error) return { ok: false, error: "Could not update the list." };
  after(async () => {
    try {
      await runTick();
    } catch {
      // The cron tick picks the list up within a minute.
    }
  });
  revalidatePath("/lists", "layout");
  return { ok: true, data: undefined };
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

  const queued = await queueList({ client: supabase, workspaceId: session.workspace.id, list, input: { name, fields, rowLimit: null } });
  if (queued) return fail(queued.error, queued.shortBy);

  revalidatePath("/enrich");
  return { ok: true, listId: list.id };
}
