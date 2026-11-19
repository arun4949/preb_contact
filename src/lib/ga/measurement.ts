import "server-only";

import { cookies } from "next/headers";
import { log, logError } from "@/lib/jobs/shared";
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VALUE, gaApiSecret, gaMeasurementId } from "./config";
import { gaClientIdFromCookie, gaSessionCookieName, gaSessionIdFromCookie } from "./cookies";

/**
 * GA4 Measurement Protocol (server events). Used where the browser cannot
 * report reliably: begin_checkout (the redirect to Stripe discards gtag's
 * pending batch, 0 of 3 hits arrived in the 2026-11-19 walk) and the first
 * subscription payment, which only Stripe's webhook confirms. The browser ids travel in the Stripe subscription
 * metadata, captured at checkout and only with analytics consent.
 */

export interface GaBrowserContext {
  clientId: string;
  sessionId: string | null;
}

/** GA ids of the current request; null without analytics consent or without the `_ga` cookie. */
export async function readGaRequestContext(): Promise<GaBrowserContext | null> {
  const measurementId = gaMeasurementId();
  if (!measurementId) return null;
  const store = await cookies();
  if (store.get(ANALYTICS_CONSENT_COOKIE)?.value !== ANALYTICS_CONSENT_VALUE) return null;
  const clientId = gaClientIdFromCookie(store.get("_ga")?.value);
  if (!clientId) return null;
  return { clientId, sessionId: gaSessionIdFromCookie(store.get(gaSessionCookieName(measurementId))?.value) };
}

/** Stripe metadata keys (string values only). */
export const GA_CLIENT_ID_METADATA_KEY = "ga_client_id";
export const GA_SESSION_ID_METADATA_KEY = "ga_session_id";

export function gaTrackingMetadata(ctx: GaBrowserContext | null): Record<string, string> {
  if (!ctx) return {};
  const out: Record<string, string> = { [GA_CLIENT_ID_METADATA_KEY]: ctx.clientId };
  if (ctx.sessionId) out[GA_SESSION_ID_METADATA_KEY] = ctx.sessionId;
  return out;
}

export function gaContextFromMetadata(metadata: Record<string, string> | null | undefined): GaBrowserContext | null {
  const clientId = metadata?.[GA_CLIENT_ID_METADATA_KEY];
  if (!clientId || !/^\d+\.\d+$/.test(clientId)) return null;
  const sessionId = metadata?.[GA_SESSION_ID_METADATA_KEY];
  return { clientId, sessionId: sessionId && /^\d+$/.test(sessionId) ? sessionId : null };
}

export type GaServerEvent = "begin_checkout" | "purchase";

export interface GaCommerceInput {
  /** Purchases only; GA deduplicates by it, so Stripe retries never double count. */
  transactionId?: string;
  value: number;
  currency: string;
  planKey: string;
}

export function buildGaPayload(ctx: GaBrowserContext, name: GaServerEvent, input: GaCommerceInput) {
  const value = Math.round(input.value * 100) / 100;
  const params: Record<string, unknown> = {
    value,
    currency: input.currency.toUpperCase(),
    items: [{ item_id: input.planKey, item_name: input.planKey, price: value, quantity: 1 }],
    // Counts the hit as engaged and, with session_id, ties it to the visit's traffic source.
    engagement_time_msec: 1,
  };
  if (input.transactionId) params.transaction_id = input.transactionId;
  if (ctx.sessionId) params.session_id = ctx.sessionId;
  return { client_id: ctx.clientId, events: [{ name, params }] };
}

/**
 * Fire and forget (call inside `after()`); never throws. Without consent
 * (`ctx` null) or without the measurement id / API secret nothing is sent.
 */
export async function sendGaEvent(ctx: GaBrowserContext | null, name: GaServerEvent, input: GaCommerceInput): Promise<void> {
  const measurementId = gaMeasurementId();
  const secret = gaApiSecret();
  if (!measurementId || !secret) return;
  if (!ctx) {
    log("ga.skipped", { gaEvent: name, reason: "no_consent" });
    return;
  }
  try {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(secret)}`;
    const res = await fetch(url, { method: "POST", body: JSON.stringify(buildGaPayload(ctx, name, input)) });
    if (!res.ok) throw new Error(`GA responded ${res.status}`);
    log("ga.sent", { gaEvent: name, transactionId: input.transactionId ?? null });
  } catch (error) {
    logError("ga.failed", error, { gaEvent: name });
  }
}
