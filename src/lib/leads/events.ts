import "server-only";

import type { Admin } from "@/lib/jobs/shared";
import type { Json, TablesUpdate } from "@/lib/supabase/types";

export type LeadEventKind =
  | "opened"
  | "code_failed"
  | "locked"
  | "unlocked"
  | "viewed"
  | "downloaded"
  | "popup_shown"
  | "cta_signin"
  | "cta_signup"
  | "cta_offer"
  | "signed_up"
  | "revoked"
  | "restored"
  | "code_regenerated";

/** One engagement row. Never stores an IP address or a user agent. Never throws. */
export async function logShareEvent(admin: Admin, shareId: string, kind: LeadEventKind, meta: Record<string, Json> = {}): Promise<void> {
  const { error } = await admin.from("lead_share_events").insert({ share_id: shareId, kind, meta });
  if (error) console.error(JSON.stringify({ scope: "leads", event: "event_insert_failed", shareId, kind, error: error.message }));
}

/** Bump `last_seen_at` (and a first-time column when still null). Never throws. */
export async function touchShare(admin: Admin, shareId: string, firstTime?: "first_opened_at" | "unlocked_at" | "popup_shown_at"): Promise<void> {
  const now = new Date().toISOString();
  await admin.from("lead_shares").update({ last_seen_at: now }).eq("id", shareId);
  if (firstTime) {
    const patch: TablesUpdate<"lead_shares"> = firstTime === "first_opened_at" ? { first_opened_at: now } : firstTime === "unlocked_at" ? { unlocked_at: now } : { popup_shown_at: now };
    await admin.from("lead_shares").update(patch).eq("id", shareId).is(firstTime, null);
  }
}
