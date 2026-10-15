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

/** Fires a standard pixel event with the shared `eventID`; silent without the pixel. */
export function trackMetaEvent(name: MetaBrowserEvent, params: Record<string, string | number> = {}, eventId?: string): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq("track", name, params, eventId ? { eventID: eventId } : undefined);
  } catch {
    // Never let tracking break a user action.
  }
}

/** Event ids are generated here (uuid) and echoed by the server; anything else is dropped. */
export function isMetaEventId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value);
}
