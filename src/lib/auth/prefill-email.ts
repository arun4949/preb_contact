/**
 * Cookie the preb.co hero form (Framer custom code) sets on `.preb.co` with
 * the email the visitor typed, so /login can prefill it. Lives 10 minutes and
 * is cleared by the login page once read.
 */
export const PREFILL_EMAIL_COOKIE = "preb_prefill_email";

/** Expire the handoff cookie on both the shared domain and the current host. */
export function clearPrefillEmailCookie() {
  document.cookie = `${PREFILL_EMAIL_COOKIE}=; domain=.preb.co; path=/; max-age=0`;
  document.cookie = `${PREFILL_EMAIL_COOKIE}=; path=/; max-age=0`;
}
