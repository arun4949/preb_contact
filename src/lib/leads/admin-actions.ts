"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/auth/work-email";
import { fileTypeFor, MAX_BYTES, parseSpreadsheet } from "@/lib/csv/parse";
import { cleanEmail, cleanLinkedin } from "@/lib/csv/normalize";
import type { EnrichmentField } from "@/lib/credits/estimate";
import { firstNameFor } from "@/lib/email/name";
import { insertContacts, purgeCacheRows, queueList, type Result } from "@/lib/lists/insert-contacts";
import { MANUAL_HEADERS, MANUAL_MAPPING } from "@/lib/lists/manual";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Json, Tables } from "@/lib/supabase/types";
import { LEAD_MAX_ROWS, leadPath } from "./constants";
import { logShareEvent } from "./events";
import { leadOwnerView, type LeadOwnerView } from "./owners";
import { normalisePasted, normaliseSheet, parsePastedContacts } from "./parse-input";
import { createShareToken, generateCode } from "./token";
import { ensureInternalWorkspace } from "./workspace";

/* ------------------------------------------------------------------ types */

export interface LeadShareSummary {
  id: string;
  listId: string;
  leadName: string;
  leadLinkedinUrl: string;
  leadEmail: string | null;
  leadCompany: string | null;
  owner: LeadOwnerView & { id: string };
  createdBy: string;
  code: string;
  /** Public path (without origin); the client builds the URL from `window.location.origin`. */
  path: string;
  list: Pick<Tables<"lists">, "name" | "status" | "processed_rows" | "total_rows" | "enrichable_rows" | "credits_used" | "found_work_email" | "found_personal_email" | "found_phone">;
  revokedAt: string | null;
  lockedUntil: string | null;
  firstOpenedAt: string | null;
  unlockedAt: string | null;
  lastSeenAt: string | null;
  popupShownAt: string | null;
  downloadCount: number;
  ctaClicks: number;
  signedUpAt: string | null;
  signedUp: { name: string | null; email: string } | null;
  createdAt: string;
}

export interface AdminProfile {
  id: string;
  name: string;
  email: string;
}

export interface CreatedLeadShare {
  shareId: string;
  listId: string;
  leadName: string;
  path: string;
  code: string;
  rows: number;
}

/* ---------------------------------------------------------------- helpers */

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
  return session;
}

const clean = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Admin profiles (owners a lead can be assigned to). */
export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, full_name, email").order("created_at");
  return (data ?? [])
    .filter((p) => isAdminEmail(p.email))
    .map((p) => ({ id: p.id, name: p.full_name?.trim() || p.email, email: p.email }));
}

/* ----------------------------------------------------------------- create */

/**
 * Create a lead list in the internal workspace, enrich it (never charged)
 * and open a public share for it. `formData` fields: lead_name,
 * lead_linkedin_url, lead_company, lead_email, owner_id, field (multi),
 * mode (paste | upload), paste, file.
 */
export async function createLeadShare(formData: FormData): Promise<Result<CreatedLeadShare>> {
  const session = await requireAdmin();
  const admin = createAdminClient();

  const leadName = clean(formData.get("lead_name"), 120);
  if (leadName.length < 2) return { ok: false, error: "Enter the lead's name." };
  const linkedin = cleanLinkedin(clean(formData.get("lead_linkedin_url"), 300));
  if (!linkedin) return { ok: false, error: "Enter the lead's LinkedIn profile URL." };
  const company = clean(formData.get("lead_company"), 120) || null;
  const emailRaw = clean(formData.get("lead_email"), 254);
  const email = emailRaw ? cleanEmail(emailRaw) : null;
  if (emailRaw && !email) return { ok: false, error: "The lead's email address does not look right." };

  const ownerId = clean(formData.get("owner_id"), 64) || session.userId;
  const { data: owner } = await admin.from("profiles").select("id, email").eq("id", ownerId).maybeSingle();
  if (!owner || !isAdminEmail(owner.email)) return { ok: false, error: "The owner must be a Preb admin." };

  const allowed: EnrichmentField[] = ["work_email", "personal_email", "mobile_phone"];
  const fields = allowed.filter((f) => formData.getAll("field").includes(f));
  if (fields.length === 0) return { ok: false, error: "Choose at least one thing to find." };

  const mode = clean(formData.get("mode"), 10);
  let rows;
  let summary;
  let mapping: Json;
  let source: "csv" | "manual";
  let fileName: string | null = null;
  if (mode === "upload") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a CSV or XLSX file." };
    const type = fileTypeFor(file.name);
    if (!type) return { ok: false, error: "Only CSV and XLSX files are supported." };
    if (file.size > MAX_BYTES) return { ok: false, error: "Files are limited to 20 MB." };
    const sheet = parseSpreadsheet(type, await file.arrayBuffer(), true, LEAD_MAX_ROWS);
    if (sheet.rows.length === 0) return { ok: false, error: "The file has no data rows." };
    const parsed = normaliseSheet(sheet);
    rows = parsed.rows;
    summary = parsed.summary;
    mapping = { ...parsed.mapping, headers: parsed.headers } as Json;
    source = "csv";
    fileName = file.name.slice(0, 200);
  } else {
    const pasted = parsePastedContacts(clean(formData.get("paste"), 20_000));
    if (pasted.cells.length === 0) {
      return { ok: false, error: pasted.rejected.length ? `No usable line. First problem: "${pasted.rejected[0].slice(0, 80)}"` : "Paste at least one LinkedIn URL or a name with a company domain." };
    }
    const parsed = normalisePasted(pasted.cells);
    rows = parsed.rows;
    summary = parsed.summary;
    mapping = { ...MANUAL_MAPPING, headers: MANUAL_HEADERS } as Json;
    source = "manual";
  }
  if (summary.enrichable === 0) return { ok: false, error: "No row has enough information to enrich. Each person needs a LinkedIn URL, or a first name, last name and company domain." };

  const workspaceId = await ensureInternalWorkspace(admin, session.userId);
  const listName = `Sample for ${firstNameFor(leadName, "") || leadName}${company ? ` at ${company}` : ""}`.slice(0, 120);
  const { data: list, error: insErr } = await admin
    .from("lists")
    .insert({
      workspace_id: workspaceId,
      created_by: session.userId,
      name: listName,
      status: "draft",
      source,
      file_name: fileName,
      column_mapping: mapping,
      has_header: true,
      duplicates_removed: summary.duplicates,
    })
    .select("*")
    .single();
  if (insErr || !list) return { ok: false, error: "Could not create the list. Please try again." };

  const fail = async (error: string): Promise<Result<CreatedLeadShare>> => {
    await admin.from("lists").delete().eq("id", list.id);
    return { ok: false, error };
  };

  const inserted = await insertContacts(admin, workspaceId, list.id, rows);
  if (!inserted.ok) return fail(inserted.error);

  const queued = await queueList({ client: admin, workspaceId, list, input: { name: listName, fields, rowLimit: LEAD_MAX_ROWS }, skipCredits: true });
  if (queued) return fail(queued.error);

  const { token, tokenHash } = createShareToken();
  const code = generateCode();
  const { data: share, error: shareErr } = await admin
    .from("lead_shares")
    .insert({
      list_id: list.id,
      workspace_id: workspaceId,
      owner_id: owner.id,
      created_by: session.userId,
      lead_name: leadName,
      lead_linkedin_url: linkedin,
      lead_email: email,
      lead_company: company,
      token,
      token_hash: tokenHash,
      code,
    })
    .select("id")
    .single();
  if (shareErr || !share) return fail("Could not create the share link. Please try again.");

  revalidatePath("/admin/leads");
  return { ok: true, data: { shareId: share.id, listId: list.id, leadName, path: leadPath(token), code, rows: summary.enrichable } };
}

/* ------------------------------------------------------------------- list */

export async function fetchLeadShares(): Promise<LeadShareSummary[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: shares } = await admin
    .from("lead_shares")
    .select("*, list:lists(name, status, processed_rows, total_rows, enrichable_rows, credits_used, found_work_email, found_personal_email, found_phone), owner:profiles!lead_shares_owner_id_fkey(id, full_name, email, avatar_url), signed:profiles!lead_shares_signed_up_user_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = shares ?? [];
  const ids = rows.map((s) => s.id);
  const { data: clicks } = ids.length
    ? await admin.from("lead_share_events").select("share_id").in("share_id", ids).in("kind", ["cta_signin", "cta_signup", "cta_offer"]).limit(10_000)
    : { data: [] };
  const clicksBy = new Map<string, number>();
  for (const c of clicks ?? []) clicksBy.set(c.share_id, (clicksBy.get(c.share_id) ?? 0) + 1);

  return rows.flatMap((s) => {
    const list = s.list as unknown as LeadShareSummary["list"] | null;
    const owner = s.owner as unknown as { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
    const signed = s.signed as unknown as { full_name: string | null; email: string } | null;
    if (!list || !owner) return [];
    return [
      {
        id: s.id,
        listId: s.list_id,
        leadName: s.lead_name,
        leadLinkedinUrl: s.lead_linkedin_url,
        leadEmail: s.lead_email,
        leadCompany: s.lead_company,
        owner: { id: owner.id, ...leadOwnerView(owner) },
        createdBy: s.created_by,
        code: s.code,
        path: leadPath(s.token),
        list,
        revokedAt: s.revoked_at,
        lockedUntil: s.locked_until,
        firstOpenedAt: s.first_opened_at,
        unlockedAt: s.unlocked_at,
        lastSeenAt: s.last_seen_at,
        popupShownAt: s.popup_shown_at,
        downloadCount: s.download_count,
        ctaClicks: clicksBy.get(s.id) ?? 0,
        signedUpAt: s.signed_up_at,
        signedUp: signed ? { name: signed.full_name, email: signed.email } : null,
        createdAt: s.created_at,
      },
    ];
  });
}

/* -------------------------------------------------------------- actions */

async function loadShare(admin: ReturnType<typeof createAdminClient>, shareId: string) {
  const { data } = await admin.from("lead_shares").select("*").eq("id", shareId).maybeSingle();
  if (!data) throw new Error("Share not found");
  return data;
}

/** New URL token: the old link stops working at once. */
export async function regenerateLeadLink(shareId: string): Promise<Result<{ path: string }>> {
  await requireAdmin();
  const admin = createAdminClient();
  await loadShare(admin, shareId);
  const { token, tokenHash } = createShareToken();
  const { error } = await admin.from("lead_shares").update({ token, token_hash: tokenHash, failed_attempts: 0, locked_until: null }).eq("id", shareId);
  if (error) return { ok: false, error: "Could not rotate the link." };
  await logShareEvent(admin, shareId, "code_regenerated", { what: "link" });
  revalidatePath("/admin/leads");
  return { ok: true, data: { path: leadPath(token) } };
}

export async function regenerateLeadCode(shareId: string): Promise<Result<{ code: string }>> {
  await requireAdmin();
  const admin = createAdminClient();
  await loadShare(admin, shareId);
  const code = generateCode();
  const { error } = await admin.from("lead_shares").update({ code, failed_attempts: 0, locked_until: null }).eq("id", shareId);
  if (error) return { ok: false, error: "Could not regenerate the code." };
  await logShareEvent(admin, shareId, "code_regenerated", { what: "code" });
  revalidatePath("/admin/leads");
  return { ok: true, data: { code } };
}

export async function setLeadShareRevoked(shareId: string, revoked: boolean): Promise<Result> {
  await requireAdmin();
  const admin = createAdminClient();
  await loadShare(admin, shareId);
  const { error } = await admin.from("lead_shares").update({ revoked_at: revoked ? new Date().toISOString() : null }).eq("id", shareId);
  if (error) return { ok: false, error: revoked ? "Could not revoke the link." : "Could not restore the link." };
  await logShareEvent(admin, shareId, revoked ? "revoked" : "restored");
  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}

/** Hard delete: the list (contacts cascade), cached results and the share (events cascade). */
export async function deleteLeadShare(shareId: string): Promise<Result> {
  await requireAdmin();
  const admin = createAdminClient();
  const share = await loadShare(admin, shareId);
  const { data: list } = await admin.from("lists").select("id, status, workspace_id").eq("id", share.list_id).maybeSingle();
  if (list && ["queued", "enriching", "stopping"].includes(list.status)) {
    return { ok: false, error: "This sample is still enriching. Wait until it is done, then delete it." };
  }
  if (list) {
    const { data: hashRows } = await admin.from("list_contacts").select("input_hash").eq("list_id", list.id).not("input_hash", "is", null);
    const { error } = await admin.from("lists").delete().eq("id", list.id);
    if (error) return { ok: false, error: "Could not delete the list." };
    await purgeCacheRows(admin, list.workspace_id, (hashRows ?? []).map((r) => r.input_hash!));
  } else {
    await admin.from("lead_shares").delete().eq("id", shareId);
  }
  revalidatePath("/admin/leads");
  return { ok: true, data: undefined };
}
