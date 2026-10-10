import type { MetadataRoute } from "next";

/**
 * The app runs on app.preb.co; the marketing website (Framer) owns preb.co.
 * Only the sign-in page is worth indexing here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/login",
      disallow: ["/lists", "/enrich", "/onboarding", "/admin", "/invite/", "/auth/", "/api/"],
    },
  };
}
