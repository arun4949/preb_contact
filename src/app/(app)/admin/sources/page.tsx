import { redirect } from "next/navigation";

/**
 * /admin/sources moved to /admin/insights on 2026-11-20, when the page gained
 * the ATS view. Old links and bookmarks keep working, with their filters.
 * No data is read here; the target page checks the admin allowlist.
 */
export default async function AdminSourcesRedirect({ searchParams }: PageProps<"/admin/sources">) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) query.append(key, item);
  }
  const qs = query.toString();
  redirect(qs ? `/admin/insights?${qs}` : "/admin/insights");
}
