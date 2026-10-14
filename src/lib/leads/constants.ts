/**
 * Lead magnet funnel: pure constants shared by the server, the admin pages
 * and the public lead share page. Keep this file free of server imports.
 */

/** Rows per lead list: the offer is "10 to 20 profiles", with headroom. */
export const LEAD_MAX_ROWS = 50;
/** Digits in the access code the lead types on the gate. */
export const LEAD_CODE_LENGTH = 4;
/** Wrong codes before the link locks. */
export const LEAD_MAX_ATTEMPTS = 5;
/** How long a locked link stays locked. */
export const LEAD_LOCK_MINUTES = 15;
/** A correct code keeps the list open on that browser for this long. */
export const LEAD_ACCESS_DAYS = 30;
/** Cookie that attributes a later signup to the share it came from. */
export const LEAD_REF_COOKIE = "preb_lead_ref";
/** Cookie that remembers the ref for this long. */
export const LEAD_REF_DAYS = 30;
/** Cookie set by the gate; the share id is appended. */
export const LEAD_ACCESS_COOKIE_PREFIX = "preb_lead_";
/** The popup opens this long after the list is shown, once per browser. */
export const LEAD_OFFER_DELAY_MS = 5000;
/** Window event the Download menu fires; the popup reopens on it (every download). */
export const LEAD_OFFER_OPEN_EVENT = "preb:lead-offer-open";
/** Pause after a download before the popup opens, so the file save starts first. */
export const LEAD_OFFER_AFTER_DOWNLOAD_MS = 1200;
/** Free trial credits the popup promises (the signup trigger grants them). */
export const LEAD_OFFER_CREDITS = 50;
/** Shares with no activity for this long are deleted by the daily job (privacy policy). */
export const LEAD_SHARE_RETENTION_MONTHS = 12;

/** In-app path of a share. */
export function leadPath(token: string) {
  return `/l/${token}`;
}

export type LeadCtaIntent = "signin" | "signup" | "offer";

/** Where the Sign in / Sign up buttons and the popup send the lead (logs the click, sets cookies, redirects to /login). */
export function leadGoPath(token: string, intent: LeadCtaIntent) {
  return `/l/${token}/go?intent=${intent}`;
}

export function leadExportPath(token: string, segment: string) {
  return `/api/l/${token}/export?segment=${segment}`;
}

/** localStorage key that remembers the popup was shown on this browser. */
export function leadOfferStorageKey(shareId: string) {
  return `preb:lead-offer:${shareId}`;
}
