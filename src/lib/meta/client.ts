/**
 * Browser helpers for the Meta Pixel. Safe to call anywhere: when the pixel is
 * not loaded (no consent, no pixel id, blocked by the browser) they are no-ops.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export type MetaBrowserEvent = "CompleteRegistration" | "InitiateCheckout";

/** One id per conversion, shared by the browser and the server event so Meta deduplicates them. */
export function newMetaEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Fires a standard pixel event with the shared `eventID`; silent without the
 * pixel. Returns true when the event was handed to the pixel, so a caller that
 * navigates away right after can give the pixel a moment to send it.
 */
export function trackMetaEvent(name: MetaBrowserEvent, params: Record<string, string | number> = {}, eventId?: string): boolean {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return false;
  try {
    window.fbq("track", name, params, eventId ? { eventID: eventId } : undefined);
    return true;
  } catch {
    // Never let tracking break a user action.
    return false;
  }
}

/**
 * How long a full-page navigation waits after a pixel event. fbevents sends
 * asynchronously, so a `location.assign` in the same tick cancels the request
 * (seen live on 2026-11-09: CompleteRegistration never left the browser).
 */
export const META_FLUSH_DELAY_MS = 600;

/** Event ids are generated here (uuid) and echoed by the server; anything else is dropped. */
export function isMetaEventId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value);
}
