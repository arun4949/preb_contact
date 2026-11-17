import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { Chip } from "@/components/base/badges/chip";
import { AccountTabs } from "@/components/application/admin-account/account-tabs";
import { ActivityTab } from "@/components/application/admin-account/activity-tab";
import { BillingTab } from "@/components/application/admin-account/billing-tab";
import { CopyValue } from "@/components/application/admin-account/copy-value";
import { CreditsTab } from "@/components/application/admin-account/credits-tab";
import { ListsTab } from "@/components/application/admin-account/lists-tab";
import { StatTile, humanize } from "@/components/application/admin-account/parts";
import { UrlSegmented } from "@/components/application/admin-account/url-controls";
import { WorkspaceTab } from "@/components/application/admin-account/workspace-tab";
import { getAccountDetail, getAccountTitle } from "@/lib/admin/accounts";
import { isUuid, parseAccountDetailParams } from "@/lib/admin/accounts-params";
import { day, n, plural, when } from "@/lib/admin/format";
import { SIGNUP_STAGE_META } from "@/lib/admin/signup-stage";
import { isAdminEmail } from "@/lib/auth/work-email";
import { formatUsd } from "@/lib/credits/money";
import { getPlan } from "@/lib/credits/plans";
import { formatPhone } from "@/lib/phone/phone";
import { getSessionContext } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

const PROVIDER: Record<string, string> = { email: "Email code", google: "Google" };

export async function generateMetadata({ params }: PageProps<"/admin/users/[id]">): Promise<Metadata> {
  const { id } = await params;
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email) || !isUuid(id)) return { title: "Account" };
  return { title: (await getAccountTitle(id)) ?? "Account" };
}

/**
 * /admin/users/[id]: one account in full. The person, their workspace, what
 * it spent and on which lists, billing and where the account came from.
 * Read-only and list level only: the contacts of a customer are never loaded
 * here. Admins only; everyone else gets a 404.
 */
export default async function AdminAccountPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();

  const { id } = await params;
  if (!isUuid(id)) notFound();
  const query = parseAccountDetailParams(await searchParams);
  const detail = await getAccountDetail(id, query);
  if (!detail) notFound();

  const { person, workspace, memberships, available, spend, totals, invoices } = detail;
  const stage = SIGNUP_STAGE_META[person.stage];
  const plan = getPlan(workspace?.plan_key);
  const planLabel = workspace?.plan_key ? (plan?.name ?? workspace.plan_key) : workspace?.trial_granted_at ? "Trial" : "No trial";
  const internal = workspace?.kind === "internal";
  const name = person.fullName ?? person.email;
  const defaultWorkspaceId = memberships.find((m) => m.isDefault)?.workspaceId ?? memberships[0]?.workspaceId ?? "";

  const paid =
    invoices.state === "ok"
      ? { value: formatUsd(invoices.totalPaidCents), hint: invoices.hasMore ? "Newest 100 invoices" : plural(invoices.invoices.filter((i) => i.status === "paid").length, "paid invoice", "paid invoices"), bad: false }
      : invoices.state === "none"
        ? { value: formatUsd(0), hint: "Never opened a checkout", bad: false }
        : invoices.state === "other_mode"
          ? { value: "—", hint: "Other Stripe mode", bad: false }
          : { value: "—", hint: "Stripe could not be reached", bad: true };

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex min-w-0 flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbItem href="/admin/users">Accounts</BreadcrumbItem>
          <BreadcrumbItem current>{name}</BreadcrumbItem>
        </Breadcrumb>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 truncate text-title-2-medium text-text-primary">{person.fullName ?? "Not onboarded"}</h1>
          <Chip variant="caption" color={stage.color}>
            {stage.label}
          </Chip>
          <Chip variant="caption" color={workspace?.plan_key ? "blue" : workspace?.trial_granted_at ? "lime" : "neutral"}>
            {planLabel}
          </Chip>
          {detail.role ? (
            <Chip variant="caption" color="soft">
              {humanize(detail.role)}
            </Chip>
          ) : null}
          {internal ? (
            <Chip variant="caption" color="purple">
              Internal
            </Chip>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-body-regular text-text-secondary">
          <CopyValue value={person.email} label="Copy email address" />
          {person.phone ? (
            <span className="inline-flex items-center gap-2">
              <a href={`tel:${person.phone.phone}`} dir="ltr" className="rounded-sm tabular-nums underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                {formatPhone(person.phone.phone)}
              </a>
              <Chip variant="caption" color={person.phone.callsAllowed ? "lime" : "neutral"}>
                {person.phone.callsAllowed ? "Call ok" : "Opted out"}
              </Chip>
            </span>
          ) : (
            <span>No phone</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-body-2-regular text-text-secondary">
          <span>Created {when(person.createdAt)}</span>
          <span>{person.onboardedAt ? `Onboarded ${when(person.onboardedAt)}` : "Not onboarded"}</span>
          <span>{person.lastSignInAt === undefined ? "Last sign-in unknown" : person.lastSignInAt ? `Last sign-in ${when(person.lastSignInAt)}` : "Never signed in"}</span>
          {person.providers?.length ? <span>Signs in with {person.providers.map((p) => PROVIDER[p] ?? humanize(p)).join(" and ")}</span> : null}
          <span>Product news {person.productNews ? "on" : "off"}</span>
        </div>
      </div>

      {memberships.length > 1 && workspace ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body-medium text-text-secondary">Workspace</span>
          <div className="max-w-full overflow-x-auto">
            <UrlSegmented
              aria-label="Workspace shown"
              param="ws"
              value={workspace.id}
              defaultValue={defaultWorkspaceId}
              options={memberships.map((m) => ({ id: m.workspaceId, label: m.name }))}
              reset={["lists", "ledger", "source", "status"]}
            />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Credits left"
          value={available.error !== null ? "—" : n(available.data)}
          hint={available.error !== null ? "Could not be loaded" : internal ? "Internal, never charged" : (workspace?.name ?? "No workspace")}
          tone={available.error !== null ? "bad" : undefined}
        />
        <StatTile
          label="Credits spent"
          value={spend.error !== null ? "—" : n(spend.data.spent)}
          hint={spend.error !== null ? "Could not be loaded" : spend.data.lastSpendAt ? `Last on ${day(spend.data.lastSpendAt)}` : "Nothing spent yet"}
          tone={spend.error !== null ? "bad" : undefined}
        />
        <StatTile
          label="Spent in the last 30 days"
          value={spend.error !== null ? "—" : n(spend.data.spent30d)}
          hint={spend.error !== null ? "Could not be loaded" : spend.data.overspend ? `${n(spend.data.overspend)} as overspend, all time` : "No overspend"}
          tone={spend.error !== null ? "bad" : undefined}
        />
        <StatTile
          label="Lists"
          value={totals.error !== null ? "—" : n(totals.data.lists)}
          hint={
            totals.error !== null
              ? "Could not be loaded"
              : `${n(totals.data.byPerson)} started by this person${totals.data.drafts ? `, ${plural(totals.data.drafts, "draft", "drafts")}` : ""}`
          }
          tone={totals.error !== null ? "bad" : undefined}
        />
        <StatTile
          label="Contacts processed"
          value={totals.error !== null ? "—" : n(totals.data.processed)}
          hint={totals.error !== null ? "Could not be loaded" : "Across lists that still exist"}
          tone={totals.error !== null ? "bad" : undefined}
        />
        <StatTile label="Total paid" value={paid.value} hint={paid.hint} tone={paid.bad ? "bad" : undefined} />
      </div>

      <AccountTabs
        initial={query.tab}
        defaultTab="lists"
        tabs={[
          { id: "lists", label: "Lists", count: totals.error === null ? totals.data.lists + totals.data.drafts : undefined, content: <ListsTab detail={detail} params={query} /> },
          { id: "credits", label: "Credits", content: <CreditsTab detail={detail} params={query} /> },
          { id: "billing", label: "Billing", content: <BillingTab detail={detail} /> },
          { id: "workspace", label: "Workspace", count: detail.members.error === null ? detail.members.data.length : undefined, content: <WorkspaceTab detail={detail} /> },
          { id: "activity", label: "Acquisition and activity", content: <ActivityTab detail={detail} /> },
        ]}
      />
    </div>
  );
}
