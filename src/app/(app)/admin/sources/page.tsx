import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { totalPages } from "@/lib/admin/accounts-params";
import { rowRange, when } from "@/lib/admin/format";
import { SIGNUP_SOURCE_STATUS_META, signupSourceLabel } from "@/lib/admin/signup-source-meta";
import { getSignupSources } from "@/lib/admin/signup-sources";
import { SOURCES_PAGE_SIZE, parseSourcesParams, periodSince } from "@/lib/admin/signup-sources-params";
import { monthLabel, sourceStats } from "@/lib/admin/signup-sources-stats";
import { isAdminEmail } from "@/lib/auth/work-email";
import { getSessionContext } from "@/lib/supabase/queries";
import { SourcesAdmin, type ResponseDisplayRow } from "./sources-admin";

export const metadata: Metadata = { title: "Acquisition sources" };
export const dynamic = "force-dynamic";

/**
 * /admin/sources: what new workspace owners answer in the optional second
 * onboarding step ("How did you first hear about Preb?"), next to what we
 * tracked ourselves (Meta ad click, referral, lead magnet). One row per asked
 * person comes from `admin_signup_sources` (migration 0035); the numbers are
 * computed in `sourceStats`. Period, team filter and page live in the URL.
 * Admins only.
 */
export default async function AdminSourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();

  const params = parseSourcesParams(await searchParams);
  const result = await getSignupSources(periodSince(params.period));
  const all = result.data ?? [];
  const teamCount = all.filter((row) => row.team).length;
  const rows = params.team === "include" ? all : all.filter((row) => !row.team);
  const stats = sourceStats(rows);

  const pages = totalPages(rows.length, SOURCES_PAGE_SIZE);
  const page = Math.min(params.page, pages);
  const slice = rows.slice((page - 1) * SOURCES_PAGE_SIZE, page * SOURCES_PAGE_SIZE);
  const responses: ResponseDisplayRow[] = slice.map((row) => ({
    id: row.userId,
    name: row.fullName,
    email: row.email,
    workspace: row.workspaceName,
    team: row.team,
    answer: row.status === "answered" && row.source ? signupSourceLabel(row.source) : null,
    status: SIGNUP_SOURCE_STATUS_META[row.status].label,
    detail: row.detail,
    asked: when(row.askedAt),
  }));

  return (
    <SourcesAdmin
      params={params}
      error={result.error}
      stats={stats}
      months={stats.byMonth.map((month) => ({ ...month, label: monthLabel(month.month), topSource: month.topSource ? signupSourceLabel(month.topSource) : null }))}
      teamCount={teamCount}
      responses={responses}
      range={rowRange(page, SOURCES_PAGE_SIZE, slice.length, rows.length)}
      page={page}
      totalPages={pages}
    />
  );
}
