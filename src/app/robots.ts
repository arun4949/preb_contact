import type { MetadataRoute } from "next";

/**
 * The app runs on the apex domain (preb.co); the marketing website will be
 * built here later. Until then only the sign-in page is worth indexing.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/login",
      disallow: ["/lists", "/onboarding", "/admin", "/invite/", "/auth/", "/api/"],
    },
  };
}
