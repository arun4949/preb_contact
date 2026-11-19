/**
 * Google Analytics 4 configuration. Everything is optional: without
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` the tag is not rendered and without
 * `GA_API_SECRET` no server event (Measurement Protocol) is sent.
 */

/** Web stream measurement id (G-…), shared with the Framer website. */
export function gaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id && /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

/** Measurement Protocol API secret of the same stream (server only). */
export function gaApiSecret(): string | null {
  const secret = process.env.GA_API_SECRET?.trim();
  return secret ? secret : null;
}

/**
 * Set by the consent-gated tag bootstrap and cleared by the Termly consent
 * listener, exactly like the Meta consent cookie. The server reads the GA
 * cookies only while it is present.
 */
export const ANALYTICS_CONSENT_COOKIE = "preb_analytics_consent";
export const ANALYTICS_CONSENT_VALUE = "1";
