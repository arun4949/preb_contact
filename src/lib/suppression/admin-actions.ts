"use server";

import { isAdminEmail } from "@/lib/auth/work-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import { log } from "@/lib/jobs/shared";
import { cacheHashesFor, identifierHash, maskIdentifier, normaliseIdentifier, type SuppressionKind } from "./identifiers";

/**
 * Admin actions for `/admin/suppressions`. Only the hashed identifier and a
 * masked hint are stored; the raw value is used once to clear stored data
 * and then discarded. Service role throughout (the scan crosses workspaces).
 */
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface SuppressionRecord {
  id: string;
  kind: SuppressionKind;
  hint: string;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
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
    .select("id, kind, value_hint, note, created_at, created_by, profiles:created_by(full_name, email)")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const by = r.profiles as unknown as { full_name: string | null; email: string } | null;
    return { id: r.id, kind: r.kind as SuppressionKind, hint: r.value_hint, note: r.note, createdAt: r.created_at, createdBy: by?.full_name ?? by?.email ?? null };
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
  const admin = createAdminClient();
  const hint = maskIdentifier(kind, value);
  const { error } = await admin
    .from("contact_suppressions")
    .upsert({ kind, value_hash: identifierHash(kind, value), value_hint: hint, note: note.trim() || null, created_by: session.userId }, { onConflict: "kind,value_hash" });
  if (error) return { ok: false, error: "Could not save the entry." };

  const { data: cleared, error: scanErr } = await admin.rpc("apply_contact_suppression", { p_kind: kind, p_value: value, p_cache_hashes: cacheHashesFor(kind, value) });
  if (scanErr) return { ok: false, error: `Saved, but clearing stored data failed: ${scanErr.message}` };
  log("suppression.added", { kind, cleared: cleared ?? 0 });
  return { ok: true, data: { cleared: cleared ?? 0, hint } };
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
