import type { MetadataRoute } from "next";
import { CONTACT_PATH, DOCS_COLLECTIONS, allArticles, collectionHref, latestUpdate } from "@/lib/docs/registry";
import { docsPath } from "@/lib/site-links";

/** Only the public pages: sign-in and the help center. The app itself is private. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.preb.co").replace(/\/$/, "");
  const latest = new Date(latestUpdate());
  return [
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}${docsPath()}`, lastModified: latest, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}${CONTACT_PATH}`, lastModified: latest, changeFrequency: "monthly", priority: 0.5 },
    ...DOCS_COLLECTIONS.map((c) => ({ url: `${base}${collectionHref(c.slug)}`, lastModified: latest, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...allArticles().map((a) => ({ url: `${base}${a.href}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
