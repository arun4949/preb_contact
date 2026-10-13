"use server";

import { isAdminEmail } from "@/lib/auth/work-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import { log } from "@/lib/jobs/shared";
import { suppressIdentifier, type SuppressionSource } from "./apply";
import { normaliseIdentifier, type SuppressionKind } from "./identifiers";

/**
 * Admin actions for `/admin/suppressions`. Only the hashed identifier and a
 * masked hint are stored; the raw value is used once to clear stored data
 * and then discarded. Service role throughout (the scan crosses workspaces).
 * Self-service requests from /opt-out land here too: the email is suppressed
 * on confirmation, phone numbers and LinkedIn URLs wait for a founder.
 */
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface SuppressionRecord {
  id: string;
  kind: SuppressionKind;
  hint: string;
  note: string | null;
  source: SuppressionSource;
  createdAt: string;
  createdBy: string | null;
}

/** A phone number or LinkedIn URL from a confirmed opt-out request, awaiting review. */
export interface PendingIdentifier {
  id: string;
  kind: "phone" | "linkedin";
  hint: string;
  requesterHint: string;
  note: string | null;
  receivedAt: string;
}

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
  return session;
}

export async function fetchSuppressions(): Promise<SuppressionRecord[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("contact_suppressions")
    .select("id, kind, value_hint, note, source, created_at, created_by, profiles:created_by(full_name, email)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const by = r.profiles as unknown as { full_name: string | null; email: string } | null;
    return {
      id: r.id,
      kind: r.kind as SuppressionKind,
      hint: r.value_hint,
      note: r.note,
      source: r.source as SuppressionSource,
      createdAt: r.created_at,
      createdBy: by?.full_name ?? by?.email ?? null,
    };
  });
}

/** Pending phone and LinkedIn identifiers of confirmed requests, oldest first. */
export async function fetchOptOutQueue(): Promise<PendingIdentifier[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("opt_out_identifiers")
    .select("id, kind, value_hint, created_at, request:opt_out_requests!inner(email_hint, note, status, confirmed_at)")
    .eq("status", "pending")
    .eq("request.status", "confirmed")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => {
    const req = r.request as unknown as { email_hint: string; note: string | null; confirmed_at: string | null };
    return { id: r.id, kind: r.kind as "phone" | "linkedin", hint: r.value_hint, requesterHint: req.email_hint, note: req.note, receivedAt: req.confirmed_at ?? r.created_at };
  });
}

/** Adds an identifier and clears everything stored for it. Returns how many contact rows were cleared. */
export async function addSuppression(kind: SuppressionKind, rawValue: string, note: string): Promise<Result<{ cleared: number; hint: string }>> {
  const session = await requireAdmin();
  if (!["email", "linkedin", "phone"].includes(kind)) return { ok: false, error: "Unknown identifier type." };
  const value = normaliseIdentifier(kind, rawValue);
  if (!value) {
    const what = kind === "email" ? "an email address" : kind === "linkedin" ? "a LinkedIn profile URL" : "a phone number with at least 6 digits";
    return { ok: false, error: `Enter ${what}.` };
  }
  try {
    const data = await suppressIdentifier(createAdminClient(), kind, value, { source: "admin", createdBy: session.userId, note });
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: message.startsWith("Saved, but") ? message : "Could not save the entry." };
  }
}

/** Approves a reviewed identifier: suppressed like an admin entry, attributed to the request. */
export async function approveOptOutIdentifier(id: string): Promise<Result<{ cleared: number; hint: string }>> {
  const session = await requireAdmin();
  const admin = createAdminClient();
  const { data: row } = await admin.from("opt_out_identifiers").select("id, kind, value, request_id, status").eq("id", id).maybeSingle();
  if (!row || row.status !== "pending") return { ok: false, error: "This entry was already reviewed." };
  if (!row.value) return { ok: false, error: "The value of this entry is no longer available." };
  try {
    const data = await suppressIdentifier(admin, row.kind as SuppressionKind, row.value, {
      source: "opt_out",
      createdBy: session.userId,
      requestId: row.request_id,
      note: "Self-service request, approved after review",
    });
    await admin.from("opt_out_identifiers").update({ status: "approved", value: null, reviewed_by: session.userId, reviewed_at: new Date().toISOString() }).eq("id", id);
    log("opt_out.identifier_approved", { kind: row.kind, cleared: data.cleared });
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { ok: false, error: message.startsWith("Saved, but") ? message : "Could not approve the entry." };
  }
}

/** Rejects a reviewed identifier; the raw value is dropped at once. */
export async function rejectOptOutIdentifier(id: string): Promise<Result> {
  const session = await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("opt_out_identifiers")
    .update({ status: "rejected", value: null, reviewed_by: session.userId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) return { ok: false, error: "Could not reject the entry." };
  if (!data?.length) return { ok: false, error: "This entry was already reviewed." };
  log("opt_out.identifier_rejected", { id });
  return { ok: true, data: undefined };
}

/** Removes an entry. Data already cleared stays cleared; the person can be enriched again in future lists. */
export async function removeSuppression(id: string): Promise<Result> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("contact_suppressions").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not remove the entry." };
  log("suppression.removed", { id });
  return { ok: true, data: undefined };
}
