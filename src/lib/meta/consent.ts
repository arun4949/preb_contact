/**
 * Advertising consent flag shared by the browser pixel and the server events.
 *
 * Termly blocks the pixel script until the visitor accepts the "advertising"
 * category. Once unblocked, the pixel script sets this first-party cookie, and
 * the Termly consent listener clears it again when consent is withdrawn. The
 * server sends a Conversions API event only when the cookie is present, so
 * nothing reaches Meta without consent on either channel.
 */
export const ADS_CONSENT_COOKIE = "preb_ads_consent";
export const ADS_CONSENT_VALUE = "1";
/** Stripe metadata key carrying the consent flag from checkout to the webhook. */
export const META_CONSENT_METADATA_KEY = "meta_consent";

/** Pure check used by both the request-bound and the metadata-bound paths. */
export function isAdsConsentValue(value: string | null | undefined): boolean {
  return value === ADS_CONSENT_VALUE;
}
