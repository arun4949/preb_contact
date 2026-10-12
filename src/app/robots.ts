import type { MetadataRoute } from "next";

/**
 * The app runs on app.preb.co; the marketing website (Framer) owns preb.co.
 * The sign-in page and the public help center are indexable, nothing else.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.preb.co").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/docs"],
      disallow: ["/lists", "/enrich", "/onboarding", "/admin", "/invite/", "/auth/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
