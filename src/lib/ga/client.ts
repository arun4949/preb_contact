/**
 * Browser helper for GA4 events. Safe to call anywhere: without consent the
 * tag is never executed, `gtag` does not exist and the call is a no-op.
 * gtag.js batches hits and flushes the batch with `sendBeacon` when the page
 * unloads. Before an external redirect (Stripe Checkout) that flush proved
 * unreliable, so such events go server-side (`measurement.ts`). Waiting for
 * `event_callback` does not help: it fires on queueing, not on sending.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export type GaBrowserEvent = "sign_up";

export function trackGaEvent(name: GaBrowserEvent, params: Record<string, unknown> = {}): boolean {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return false;
  try {
    window.gtag("event", name, params);
    return true;
  } catch {
    // Never let tracking break a user action.
    return false;
  }
}

