import "server-only";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { log, logError } from "@/lib/jobs/shared";
import { ADS_CONSENT_COOKIE, isAdsConsentValue } from "./consent";
import { META_GRAPH_VERSION, metaAccessToken, metaPixelId, metaTestEventCode } from "./config";

/**
 * Meta Conversions API (server events). Called inside `after()` from server
 * actions and the Stripe webhook, so it never blocks or breaks a user flow.
 * Only the pure builders below are unit-tested; the request-bound wrappers
 * read cookies and headers from Next.
 */

export type MetaEventName = "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";

export interface MetaUserData {
  email?: string | null;
  /** Stable first-party id (user or workspace id); hashed before sending. */
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

export interface MetaEventInput {
  eventName: MetaEventName;
  /** Shared with the browser pixel event (`eventID`) for deduplication. */
  eventId: string;
  value?: number;
  currency?: string;
  customData?: Record<string, string | number>;
  sourceUrl?: string | null;
  userData?: MetaUserData;
}

export interface MetaPayloadOptions {
  eventTime?: number;
  testEventCode?: string | null;
}

/** SHA-256 hex of the normalised value, as the Conversions API expects. */
export function hashMetaValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * `_fbc` cookie format when only the click id is known (the pixel builds the
 * same string itself once it runs): fb.1.<unix ms>.<fbclid>.
 */
export function fbcFromClickId(fbclid: string | null | undefined, now = Date.now()): string | null {
  const id = fbclid?.trim();
  if (!id || id.length > 512) return null;
  return `fb.1.${now}.${id}`;
}

export function buildMetaPayload(input: MetaEventInput, options: MetaPayloadOptions = {}) {
  const u = input.userData ?? {};
  const userData: Record<string, string> = {};
  if (u.email) userData.em = hashMetaValue(normalizeEmail(u.email));
  if (u.externalId) userData.external_id = hashMetaValue(u.externalId);
  if (u.fbp) userData.fbp = u.fbp;
  if (u.fbc) userData.fbc = u.fbc;
  if (u.clientIp) userData.client_ip_address = u.clientIp;
  if (u.userAgent) userData.client_user_agent = u.userAgent;

  const customData: Record<string, string | number> = { ...(input.customData ?? {}) };
  if (typeof input.value === "number") customData.value = Math.round(input.value * 100) / 100;
  if (input.currency) customData.currency = input.currency.toUpperCase();

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: options.eventTime ?? Math.floor(Date.now() / 1000),
    event_id: input.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (input.sourceUrl) event.event_source_url = input.sourceUrl;
  if (Object.keys(customData).length) event.custom_data = customData;

  const payload: Record<string, unknown> = { data: [event] };
  if (options.testEventCode) payload.test_event_code = options.testEventCode;
  return payload;
}

/** Posts one payload; resolves to true when Meta accepted it. Never throws. */
export async function postMetaPayload(payload: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const pixelId = metaPixelId();
  const token = metaAccessToken();
  if (!pixelId || !token) return false;
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`;
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, access_token: token }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logError("meta.rejected", new Error(`HTTP ${res.status}`), { body: body.slice(0, 300) });
      return false;
    }
    return true;
  } catch (error) {
    logError("meta.failed", error);
    return false;
  }
}

/**
 * Sends an event with explicitly supplied user data (no request context), for
 * webhooks. `consent` must come from a value captured while the user was on
 * the site (we store it in Stripe metadata at checkout).
 */
export async function sendMetaEventDetached(input: MetaEventInput, consent: boolean, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!metaPixelId() || !metaAccessToken()) return;
  if (!consent) {
    log("meta.skipped", { metaEvent: input.eventName, reason: "no_consent" });
    return;
  }
  const ok = await postMetaPayload(buildMetaPayload(input, { testEventCode: metaTestEventCode() }), fetchImpl);
  if (ok) log("meta.sent", { metaEvent: input.eventName, eventId: input.eventId });
}

/** Browser identifiers and consent read from the current request (server actions and route handlers). */
export async function readMetaRequestContext(): Promise<{ consent: boolean; fbp: string | null; fbc: string | null; clientIp: string | null; userAgent: string | null; sourceUrl: string | null }> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const consent = isAdsConsentValue(cookieStore.get(ADS_CONSENT_COOKIE)?.value);
  const referer = headerStore.get("referer");
  const forwarded = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    consent,
    fbp: cookieStore.get("_fbp")?.value ?? null,
    fbc: cookieStore.get("_fbc")?.value ?? null,
    clientIp: forwarded || headerStore.get("x-real-ip") || null,
    userAgent: headerStore.get("user-agent"),
    sourceUrl: referer && referer.length < 2048 ? referer : null,
  };
}

/**
 * Sends an event for the current request: consent cookie required, browser
 * identifiers merged in. Call from inside `after()` in a server action or
 * route handler (request APIs are available there).
 */
export async function sendMetaEvent(input: MetaEventInput): Promise<void> {
  if (!metaPixelId() || !metaAccessToken()) return;
  try {
    const ctx = await readMetaRequestContext();
    if (!ctx.consent) {
      log("meta.skipped", { metaEvent: input.eventName, reason: "no_consent" });
      return;
    }
    const merged: MetaEventInput = {
      ...input,
      sourceUrl: input.sourceUrl ?? ctx.sourceUrl,
      userData: { fbp: ctx.fbp, fbc: ctx.fbc, clientIp: ctx.clientIp, userAgent: ctx.userAgent, ...(input.userData ?? {}) },
    };
    const ok = await postMetaPayload(buildMetaPayload(merged, { testEventCode: metaTestEventCode() }));
    if (ok) log("meta.sent", { metaEvent: input.eventName, eventId: input.eventId });
  } catch (error) {
    logError("meta.failed", error, { metaEvent: input.eventName });
  }
}
