import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAccounts } from "@/lib/admin/accounts";
import { ACCOUNTS_PAGE_SIZE, parseAccountsParams, totalPages } from "@/lib/admin/accounts-params";
import { when } from "@/lib/admin/format";
import { SIGNUP_STAGE_META } from "@/lib/admin/signup-stage";
import { isAdminEmail } from "@/lib/auth/work-email";
import { getPlan } from "@/lib/credits/plans";
import { getSessionContext } from "@/lib/supabase/queries";
import { AccountsAdmin, type AccountDisplayRow } from "./accounts-admin";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

/**
 * /admin/users: every account with its default workspace, plan and credit
 * use. Search, filter, sort and paging run in the database (`admin_accounts`,
 * migration 0034) and live in the URL. A row opens /admin/users/[id]. Admins only.
 */
export default async function AdminAccountsPage({ searchParams }: PageProps<"/admin/users">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();

  const params = parseAccountsParams(await searchParams);
  const accounts = await getAccounts(params);
  const total = accounts.data?.total ?? 0;
  const pages = totalPages(total, ACCOUNTS_PAGE_SIZE);
  // A page past the end (a stale link after the list shrank) returns no rows and so no total:
  // go back to the first page instead of showing an empty table.
  if (accounts.data && accounts.data.rows.length === 0 && params.page > 1) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.filter !== "all") qs.set("filter", params.filter);
    if (params.sort !== "created") qs.set("sort", params.sort);
    if (params.dir !== "desc") qs.set("dir", params.dir);
    redirect(qs.size ? `/admin/users?${qs}` : "/admin/users");
  }

  const rows: AccountDisplayRow[] = (accounts.data?.rows ?? []).map((a) => {
    const stage = SIGNUP_STAGE_META[a.stage];
    return {
      id: a.userId,
      name: a.fullName,
      email: a.email,
      workspace: a.workspaceName,
      internal: a.workspaceKind === "internal",
      stage: { label: stage.label, color: stage.color },
      plan: {
        label: a.planKey ? (getPlan(a.planKey)?.name ?? a.planKey) : a.trialGrantedAt ? "Trial" : "No trial",
        color: a.planKey ? "blue" : a.trialGrantedAt ? "lime" : "neutral",
      },
      creditsSpent: a.creditsSpent,
      creditsAvailable: a.creditsAvailable,
      lists: a.listsCount,
      lastSignIn: a.lastSignInAt ? when(a.lastSignInAt) : null,
      created: when(a.createdAt),
    };
  });

  return <AccountsAdmin params={params} rows={rows} total={total} totalPages={pages} error={accounts.error} />;
}
