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

/** Public help center, served by this app without a session. */
export const DOCS_PATH = "/docs";

/** In-app path of a docs page: "/docs", "/docs/billing" or "/docs/billing/how-credits-work". */
export function docsPath(collection?: string, article?: string) {
  if (!collection) return DOCS_PATH;
  return article ? `${DOCS_PATH}/${collection}/${article}` : `${DOCS_PATH}/${collection}`;
}

/** Absolute docs URL for emails and external links. */
export function docsUrl(collection?: string, article?: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.preb.co").replace(/\/$/, "");
  return `${base}${docsPath(collection, article)}`;
}
