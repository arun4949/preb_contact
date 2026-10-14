import type { MetadataRoute } from "next";

/**
 * The app runs on app.preb.co; the marketing website (Framer) owns preb.co.
 * The sign-in page, the public help center and the contact opt-out form are
 * indexable, nothing else (confirmation links under /opt-out/ and the
 * code-protected lead share pages under /l/ stay out).
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.preb.co").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/docs", "/opt-out"],
      disallow: ["/lists", "/enrich", "/onboarding", "/admin", "/invite/", "/auth/", "/api/", "/opt-out/", "/l/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
