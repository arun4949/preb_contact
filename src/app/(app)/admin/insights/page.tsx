import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { totalPages } from "@/lib/admin/accounts-params";
import { rowRange, when } from "@/lib/admin/format";
import { getSignupAts } from "@/lib/admin/signup-ats";
import { SIGNUP_ATS_STATUS_META, signupAtsLabel } from "@/lib/admin/signup-ats-meta";
import { atsStats } from "@/lib/admin/signup-ats-stats";
import { SIGNUP_SOURCE_STATUS_META, signupSourceLabel } from "@/lib/admin/signup-source-meta";
import { getSignupSources } from "@/lib/admin/signup-sources";
import { SOURCES_PAGE_SIZE, parseSourcesParams, periodSince, type SourcesParams } from "@/lib/admin/signup-sources-params";
import { monthLabel, sourceStats } from "@/lib/admin/signup-sources-stats";
import { isAdminEmail } from "@/lib/auth/work-email";
import { getSessionContext } from "@/lib/supabase/queries";
import { AtsView } from "./ats-view";
import { InsightsShell } from "./insights-shell";
import { SourcesView } from "./sources-view";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

/**
 * /admin/insights: what new workspace owners tell us in the optional
 * onboarding questions. Two views, picked with `?view=`:
 *
 * - Sources: "How did you first hear about Preb?", next to what we tracked
 *   ourselves (Meta ad click, referral, lead magnet). `admin_signup_sources`
 *   (migration 0035), numbers from `sourceStats`.
 * - ATS: "Which ATS do you use?". `admin_signup_ats` (migration 0036), numbers
 *   from `atsStats`.
 *
 * Only the open view is loaded. View, period, team filter and page live in the
 * URL. Admins only.
 */
export default async function AdminInsightsPage({ searchParams }: PageProps<"/admin/insights">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();

  const params = parseSourcesParams(await searchParams);
  return params.view === "ats" ? <AtsInsights params={params} /> : <SourcesInsights params={params} />;
}

/** One page of the rows shown, clamped to the pages that exist. */
function paginate<T>(rows: T[], requested: number) {
  const pages = totalPages(rows.length, SOURCES_PAGE_SIZE);
  const page = Math.min(requested, pages);
  const slice = rows.slice((page - 1) * SOURCES_PAGE_SIZE, page * SOURCES_PAGE_SIZE);
  return { pages, page, slice, range: rowRange(page, SOURCES_PAGE_SIZE, slice.length, rows.length) };
}

async function SourcesInsights({ params }: { params: SourcesParams }) {
  const result = await getSignupSources(periodSince(params.period));
  const all = result.data ?? [];
  const rows = params.team === "include" ? all : all.filter((row) => !row.team);
  const stats = sourceStats(rows);
  const { pages, page, slice, range } = paginate(rows, params.page);

  return (
    <InsightsShell params={params} teamCount={all.filter((row) => row.team).length}>
      <SourcesView
        error={result.error}
        stats={stats}
        months={stats.byMonth.map((month) => ({ ...month, label: monthLabel(month.month), topSource: month.topSource ? signupSourceLabel(month.topSource) : null }))}
        responses={slice.map((row) => ({
          id: row.userId,
          name: row.fullName,
          email: row.email,
          workspace: row.workspaceName,
          team: row.team,
          answer: row.status === "answered" && row.source ? signupSourceLabel(row.source) : null,
          status: SIGNUP_SOURCE_STATUS_META[row.status].label,
          detail: row.detail,
          asked: when(row.askedAt),
        }))}
        range={range}
        page={page}
        totalPages={pages}
      />
    </InsightsShell>
  );
}

async function AtsInsights({ params }: { params: SourcesParams }) {
  const result = await getSignupAts(periodSince(params.period));
  const all = result.data ?? [];
  const rows = params.team === "include" ? all : all.filter((row) => !row.team);
  const stats = atsStats(rows);
  const { pages, page, slice, range } = paginate(rows, params.page);

  return (
    <InsightsShell params={params} teamCount={all.filter((row) => row.team).length}>
      <AtsView
        error={result.error}
        stats={stats}
        months={stats.byMonth.map((month) => ({ ...month, label: monthLabel(month.month), topAts: month.topAts ? signupAtsLabel(month.topAts) : null }))}
        responses={slice.map((row) => ({
          id: row.userId,
          name: row.fullName,
          email: row.email,
          workspace: row.workspaceName,
          team: row.team,
          answer: row.status === "answered" && row.ats ? signupAtsLabel(row.ats) : null,
          status: SIGNUP_ATS_STATUS_META[row.status].label,
          detail: row.detail,
          asked: when(row.askedAt),
        }))}
        range={range}
        page={page}
        totalPages={pages}
      />
    </InsightsShell>
  );
}
