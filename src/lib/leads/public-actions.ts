"use server";

import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isThrottled, throttleKey } from "@/lib/opt-out/throttle";
import { clientIp } from "@/lib/opt-out/turnstile";
import { leadCookieName, signLeadAccess, verifyLeadAccess } from "./access-cookie";
import { LEAD_LOCK_MINUTES, LEAD_MAX_ATTEMPTS } from "./constants";
import { logShareEvent, touchShare } from "./events";
import { codeMatches, hashShareToken, looksLikeCode, looksLikeShareToken } from "./token";

export type CodeResult =
  | { ok: true }
  | { ok: false; reason: "invalid"; remaining: number }
  | { ok: false; reason: "locked"; until: string }
  | { ok: false; reason: "throttled" }
  | { ok: false; reason: "unavailable" };

/** Per connection: generous for a human, tight for a script (20 tries in 15 minutes). */
const THROTTLE = { windowMs: LEAD_LOCK_MINUTES * 60_000, max: 20 };

/**
 * The code gate. Wrong codes count on the share; the fifth locks it for 15
 * minutes. A correct code sets the HttpOnly access cookie for 30 days.
 */
export async function submitLeadCode(token: string, code: string): Promise<CodeResult> {
  if (!looksLikeShareToken(token)) return { ok: false, reason: "unavailable" };
  const h = await headers();
  if (isThrottled(throttleKey(clientIp(h), h.get("user-agent")), Date.now(), THROTTLE)) return { ok: false, reason: "throttled" };

  const admin = createAdminClient();
  const { data: share } = await admin.from("lead_shares").select("id, code, failed_attempts, locked_until, revoked_at").eq("token_hash", hashShareToken(token)).maybeSingle();
  if (!share || share.revoked_at) return { ok: false, reason: "unavailable" };
  const now = Date.now();
  if (share.locked_until && new Date(share.locked_until).getTime() > now) return { ok: false, reason: "locked", until: share.locked_until };

  if (!looksLikeCode(code) || !codeMatches(code, share.code)) {
    const attempts = (share.locked_until ? 0 : share.failed_attempts) + 1;
    if (attempts >= LEAD_MAX_ATTEMPTS) {
      const until = new Date(now + LEAD_LOCK_MINUTES * 60_000).toISOString();
      await admin.from("lead_shares").update({ failed_attempts: 0, locked_until: until }).eq("id", share.id);
      await logShareEvent(admin, share.id, "locked");
      return { ok: false, reason: "locked", until };
    }
    await admin.from("lead_shares").update({ failed_attempts: attempts, locked_until: null }).eq("id", share.id);
    await logShareEvent(admin, share.id, "code_failed");
    return { ok: false, reason: "invalid", remaining: LEAD_MAX_ATTEMPTS - attempts };
  }

  await admin.from("lead_shares").update({ failed_attempts: 0, locked_until: null }).eq("id", share.id);
  const { value, expiresAt } = signLeadAccess(share.id, now);
  (await cookies()).set(leadCookieName(share.id), value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
  await touchShare(admin, share.id, "unlocked_at");
  await logShareEvent(admin, share.id, "unlocked");
  return { ok: true };
}

/** Resolves the share id of an unlocked visitor, or null. */
async function unlockedShareId(token: string): Promise<string | null> {
  if (!looksLikeShareToken(token)) return null;
  const admin = createAdminClient();
  const { data: share } = await admin.from("lead_shares").select("id, revoked_at").eq("token_hash", hashShareToken(token)).maybeSingle();
  if (!share || share.revoked_at) return null;
  const value = (await cookies()).get(leadCookieName(share.id))?.value;
  return verifyLeadAccess(share.id, value) ? share.id : null;
}

/** The popup opened: once per browser after 5 s, and again after every download. */
export async function markLeadPopupShown(token: string, trigger: "timer" | "download" = "timer"): Promise<void> {
  const id = await unlockedShareId(token);
  if (!id) return;
  const admin = createAdminClient();
  await touchShare(admin, id, "popup_shown_at");
  await logShareEvent(admin, id, "popup_shown", { trigger: trigger === "download" ? "download" : "timer" });
}

/** The unlocked list was rendered (one event per page load). */
export async function trackLeadView(token: string): Promise<void> {
  const id = await unlockedShareId(token);
  if (!id) return;
  const admin = createAdminClient();
  await touchShare(admin, id);
  await logShareEvent(admin, id, "viewed");
}
