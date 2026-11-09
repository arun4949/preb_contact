import "server-only";

import { log, logError, type Admin } from "@/lib/jobs/shared";
import { readMetaRequestContext, type MetaUserData } from "./capi";

/**
 * Stored Meta click context. A mobile lead clicks the ad in the Meta in-app
 * browser, requests a sign-in link there and opens it in Safari (or signs in
 * with the emailed code later on another device). The second browser has no
 * `_fbc`/`_fbp` cookies and no advertising consent cookie, so the server
 * events after the switch would reach Meta without the click id. We capture
 * the identifiers once, at account creation, while still in the browser that
 * clicked the ad, and attach them to later events (Meta: "you can store and
 * manage the value of the formatted ClickID in your backend storage").
 *
 * A row exists only when the capturing request carried the consent cookie,
 * so the row itself is the consent record for the later events. Rows expire
 * after `META_CLICK_CONTEXT_DAYS` (the daily job deletes them).
 */

/** How long a stored click context may be used; matches Meta's `_fbc` cookie lifetime. */
export const META_CLICK_CONTEXT_DAYS = 90;

export type MetaClickSource = "magic_link" | "oauth";

export interface StoredClickContext {
  fbc: string | null;
  fbp: string | null;
  clientIp: string | null;
  userAgent: string | null;
  capturedAt: string;
}

/** Fields of the current request that may be merged with a stored context. */
export interface RequestClickContext {
  consent: boolean;
  fbp: string | null;
  fbc: string | null;
  clientIp: string | null;
  userAgent: string | null;
}

/** True when the row is still inside the usable window. Pure, unit-tested. */
export function isClickContextFresh(capturedAt: string, now = Date.now(), days = META_CLICK_CONTEXT_DAYS): boolean {
  const t = new Date(capturedAt).getTime();
  return Number.isFinite(t) && now - t <= days * 86_400_000;
}

/**
 * Consent for a server event: the request's cookie, or a stored row captured
 * with consent earlier. Pure, unit-tested.
 */
export function hasConsent(request: Pick<RequestClickContext, "consent">, stored: StoredClickContext | null | undefined): boolean {
  return request.consent || Boolean(stored);
}

/**
 * Merges request identifiers with a stored context. Request values win (the
 * same browser, or a newer click), the stored row fills what the request
 * lacks. `clientIp`/`userAgent` describe the browser the event happened in,
 * so they fall back to the stored values only when the request has none
 * (the Stripe webhook). Pure, unit-tested.
 */
export function mergeClickContext(request: Omit<RequestClickContext, "consent">, stored: StoredClickContext | null | undefined): MetaUserData {
  return {
    fbp: request.fbp ?? stored?.fbp ?? null,
    fbc: request.fbc ?? stored?.fbc ?? null,
    clientIp: request.clientIp ?? stored?.clientIp ?? null,
    userAgent: request.userAgent ?? stored?.userAgent ?? null,
  };
}

/**
 * Captures the current request's click context for a brand-new account.
 * Called while the user is still in the browser that clicked the ad: the
 * magic-link request and the Google callback. Writes nothing without the
 * consent cookie or without at least one Meta identifier. The latest value
 * wins (Meta asks for the most recent click id). Never throws.
 */
export async function captureMetaClickContext(admin: Admin, userId: string, source: MetaClickSource): Promise<void> {
  try {
    const ctx = await readMetaRequestContext();
    if (!ctx.consent) return;
    if (!ctx.fbc && !ctx.fbp) return;
    const { error } = await admin.from("meta_click_contexts").upsert(
      {
        user_id: userId,
        fbc: ctx.fbc?.slice(0, 512) ?? null,
        fbp: ctx.fbp?.slice(0, 128) ?? null,
        client_ip: ctx.clientIp?.slice(0, 64) ?? null,
        user_agent: ctx.userAgent?.slice(0, 512) ?? null,
        source,
        captured_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    log("meta.click_context_stored", { userId, source, hasFbc: Boolean(ctx.fbc), hasFbp: Boolean(ctx.fbp) });
  } catch (error) {
    logError("meta.click_context_failed", error, { userId, source });
  }
}

/** The stored context of a user, or null when there is none or it has expired. Never throws. */
export async function readMetaClickContext(admin: Admin, userId: string): Promise<StoredClickContext | null> {
  try {
    const { data, error } = await admin
      .from("meta_click_contexts")
      .select("fbc, fbp, client_ip, user_agent, captured_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !isClickContextFresh(data.captured_at)) return null;
    return { fbc: data.fbc, fbp: data.fbp, clientIp: data.client_ip, userAgent: data.user_agent, capturedAt: data.captured_at };
  } catch (error) {
    logError("meta.click_context_read_failed", error, { userId });
    return null;
  }
}
