/**
 * The marketing website and the legal pages live on preb.co (Framer, run by
 * Leon); the app runs on app.preb.co. App links to the legal pages are
 * absolute so they never depend on the app's own routes.
 */
export const MARKETING_SITE_URL = "https://preb.co";

export const LEGAL_URLS = {
  terms: `${MARKETING_SITE_URL}/terms`,
  privacy: `${MARKETING_SITE_URL}/privacy`,
} as const;
