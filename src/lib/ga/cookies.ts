/**
 * Pure parsers for the cookies gtag.js sets on `.preb.co`, used to attribute
 * server events (Measurement Protocol) to the visitor's browser and session.
 */

/** `_ga` = `GA1.1.<random>.<timestamp>`; the client id is the last two parts. */
export function gaClientIdFromCookie(value: string | null | undefined): string | null {
  const match = value?.trim().match(/^GA\d+\.\d+\.(\d+\.\d+)$/);
  return match ? match[1] : null;
}

/**
 * `_ga_<stream suffix>` carries the current session id. Two formats exist:
 * `GS1.1.<session id>.<count>.…` and `GS2.1.s<session id>$o<count>$g…`.
 */
export function gaSessionIdFromCookie(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const gs2 = v.match(/^GS2\.\d+\.s(\d+)(?:\$|$)/);
  if (gs2) return gs2[1];
  const gs1 = v.match(/^GS1\.\d+\.(\d+)\./);
  return gs1 ? gs1[1] : null;
}

/** Cookie name of the session cookie for a measurement id: G-ABC123 → _ga_ABC123. */
export function gaSessionCookieName(measurementId: string): string {
  return `_ga_${measurementId.replace(/^G-/, "")}`;
}
