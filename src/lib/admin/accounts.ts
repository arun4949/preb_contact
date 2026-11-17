import "server-only";

import { isAdminEmail, isFreeEmailDomain, emailDomain } from "@/lib/auth/work-email";
import { workspaceOverspendState, type WorkspaceOverspendState } from "@/lib/billing/overspend";
import { listCustomerInvoices, stripeCustomerUrl, type CustomerInvoices } from "@/lib/stripe/invoices";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Tables } from "@/lib/supabase/types";
import {
  ACCOUNTS_PAGE_SIZE,
  DETAIL_PAGE_SIZE,
  type AccountDetailParams,
  type AccountsParams,
  type ListStatusFilter,
} from "./accounts-params";
import { metaAttribution, type MetaAttribution } from "./attribution";
import { signupStage, type SignupStage } from "./signup-stage";

/**
 * Data for the admin account pages (/admin/ops signups, /admin/users and
 * /admin/users/[id]). Service-role reads across all workspaces, so every
 * loader checks the allowlist itself on top of the page guard.
 *
 * List level only: nothing here reads `list_contacts`. Admins see what a
 * workspace did (lists, counts, credits), never the contacts of a customer
 * (privacy policy § 4 "Internal administration": account and usage data).
 *
 * A failed query never looks like "nothing there": each part of the detail
 * page carries its own error and the page shows it in place of the section.
 */

type Admin = ReturnType<typeof createAdminClient>;
type ListStatus = Tables<"lists">["status"];

export type Part<T> = { data: T; error: null } | { data: null; error: string };

const ok = <T,>(data: T): Part<T> => ({ data, error: null });
const fail = (error: { message: string; code?: string } | string): Part<never> => ({
  data: null,
  error: typeof error === "string" ? error : `${error.code ? `${error.code} ` : ""}${error.message}`,
});

async function assertAdmin(): Promise<void> {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
}

/* ------------------------------------------------------------------ spend */

export interface WorkspaceSpend {
  spent: number;
  fromBalance: number;
  overspend: number;
  absorbed: number;
  spent30d: number;
  lastSpendAt: string | null;
}

export const NO_SPEND: WorkspaceSpend = { spent: 0, fromBalance: 0, overspend: 0, absorbed: 0, spent30d: 0, lastSpendAt: null };

async function loadSpend(admin: Admin, ids: readonly string[]): Promise<Part<Map<string, WorkspaceSpend>>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, WorkspaceSpend>();
  if (unique.length === 0) return ok(out);
  const { data, error } = await admin.rpc("admin_workspace_spend", { p_workspaces: unique });
  if (error) return fail(error);
  // Workspaces without spend return no row: they are a real zero, not a gap.
  for (const id of unique) out.set(id, NO_SPEND);
  for (const row of data ?? []) {
    out.set(row.workspace_id, {
      spent: row.spent,
      fromBalance: row.from_balance,
      overspend: row.overspend,
      absorbed: row.absorbed,
      spent30d: row.spent_30d,
      lastSpendAt: row.last_spend_at ?? null,
    });
  }
  return ok(out);
}

/** Credits spent per workspace, from the ledger (definition: migration 0034). */
export async function getWorkspaceSpend(ids: readonly string[]): Promise<Part<Map<string, WorkspaceSpend>>> {
  await assertAdmin();
  return loadSpend(createAdminClient(), ids);
}

/* --------------------------------------------------------------- accounts */

export interface AccountRow {
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  onboardedAt: string | null;
  lastSignInAt: string | null;
  stage: SignupStage;
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceKind: string | null;
  planKey: string | null;
  trialGrantedAt: string | null;
  role: string | null;
  creditsSpent: number;
  creditsAvailable: number;
  listsCount: number;
}

export interface AccountsPage {
  rows: AccountRow[];
  total: number;
}

/** One page of accounts: search, filter, sort and paging run in `admin_accounts`. */
export async function getAccounts(params: AccountsParams): Promise<Part<AccountsPage>> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_accounts", {
    p_search: params.q,
    p_filter: params.filter,
    p_sort: params.sort,
    p_dir: params.dir,
    p_limit: ACCOUNTS_PAGE_SIZE,
    p_offset: (params.page - 1) * ACCOUNTS_PAGE_SIZE,
  });
  if (error) return fail(error);
  // The generated types mark every column as present; left joins make these nullable.
  const rows = (data ?? []) as unknown as (Omit<
    NonNullable<typeof data>[number],
    "full_name" | "onboarded_at" | "last_sign_in_at" | "workspace_id" | "workspace_name" | "workspace_kind" | "plan_key" | "trial_granted_at" | "member_role"
  > & {
    full_name: string | null;
    onboarded_at: string | null;
    last_sign_in_at: string | null;
    workspace_id: string | null;
    workspace_name: string | null;
    workspace_kind: string | null;
    plan_key: string | null;
    trial_granted_at: string | null;
    member_role: string | null;
  })[];
  return ok({
    total: rows.length ? Number(rows[0].total_count) : 0,
    rows: rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      fullName: r.full_name,
      createdAt: r.created_at,
      onboardedAt: r.onboarded_at,
      lastSignInAt: r.last_sign_in_at,
      stage: signupStage({ onboardedAt: r.onboarded_at, lastSignInAt: r.last_sign_in_at }),
      workspaceId: r.workspace_id,
      workspaceName: r.workspace_name,
      workspaceKind: r.workspace_kind,
      planKey: r.plan_key,
      trialGrantedAt: r.trial_granted_at,
      role: r.member_role,
      creditsSpent: r.credits_spent,
      creditsAvailable: r.credits_available,
      listsCount: r.lists_count,
    })),
  });
}

/* ----------------------------------------------------------------- detail */

export type WorkspaceRow = Tables<"workspaces">;

export interface AccountPerson {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  onboardedAt: string | null;
  productNews: boolean;
  phone: { phone: string; callsAllowed: boolean } | null;
  /** `undefined` when the auth lookup failed. */
  lastSignInAt: string | null | undefined;
  /** Sign-in methods on the account ("email", "google"); null when the auth lookup failed. */
  providers: string[] | null;
  stage: SignupStage;
}

export interface AccountMembership {
  workspaceId: string;
  name: string;
  role: string;
  isDefault: boolean;
}

export interface AdminList {
  id: string;
  /** Null for Enrich tab lookups: their name is the looked-up person, which is customer content. */
  name: string | null;
  source: string;
  sourceDetail: string | null;
  status: ListStatus;
  pauseReason: string | null;
  createdBy: string;
  createdByName: string | null;
  totalRows: number;
  processedRows: number;
  foundWorkEmail: number;
  foundPersonalEmail: number;
  foundPhone: number;
  notFound: number;
  creditsUsed: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WorkspaceTotals {
  /** Lists that were started (everything but drafts). */
  lists: number;
  drafts: number;
  /** Contacts processed across all lists that still exist. */
  processed: number;
  /** Lists this person started, and the credits those used. */
  byPerson: number;
  byPersonCredits: number;
}

export interface AdminGrant {
  id: string;
  amount: number;
  remaining: number;
  source: string;
  note: string | null;
  grantedAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface AdminLedgerRow {
  id: number;
  createdAt: string;
  kind: Tables<"credit_ledger">["kind"];
  delta: number;
  note: string | null;
  /** List name for the label; "Deleted list" once the list is gone, "Single lookup" for Enrich tab runs. */
  listName: string | null;
}

export interface AdminOverage {
  id: string;
  createdAt: string;
  credits: number;
  status: string;
  amountCents: number | null;
  stripeInvoiceId: string | null;
  error: string | null;
}

export interface AdminMember {
  userId: string;
  fullName: string | null;
  email: string;
  role: string;
  joinedAt: string;
}

export interface AdminInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

export interface AccountDetail {
  person: AccountPerson;
  memberships: AccountMembership[];
  workspace: WorkspaceRow | null;
  role: string | null;
  available: Part<number>;
  spend: Part<WorkspaceSpend>;
  totals: Part<WorkspaceTotals>;
  lists: Part<{ rows: AdminList[]; total: number }>;
  grants: Part<AdminGrant[]>;
  ledger: Part<{ rows: AdminLedgerRow[]; total: number }>;
  overspend: Part<WorkspaceOverspendState | null>;
  overages: Part<AdminOverage[]>;
  invoices: CustomerInvoices;
  stripeUrl: string | null;
  members: Part<AdminMember[]>;
  invites: Part<AdminInvite[]>;
  meta: Part<{ attribution: MetaAttribution; source: string | null; capturedAt: string | null }>;
  referredBy: Part<{ workspaceId: string | null; workspaceName: string; status: string; source: string; rejectedReason: string | null; signedUpAt: string } | null>;
  referralCode: Part<{ code: string; clicks: number; revoked: boolean; signups: number; rewarded: number; rewardCredits: number } | null>;
  leadShare: Part<{ listId: string; signedUpAt: string | null } | null>;
  mcp: Part<{ clientName: string; toolCalls: number; lastUsedAt: string | null; connectedAt: string }[]>;
  emails: Part<{ id: number; kind: string; sentAt: string }[]>;
  /** Null for free-mail addresses, where the domain says nothing about the company. */
  sameDomain: Part<{ domain: string; accounts: { userId: string; fullName: string | null; email: string; createdAt: string; onboarded: boolean }[] } | null>;
}

const STATUS_GROUPS: Record<Exclude<ListStatusFilter, "all">, ListStatus[]> = {
  running: ["queued", "enriching", "stopping"],
  finished: ["completed", "stopped"],
  attention: ["paused_credits", "paused_upstream", "failed"],
  draft: ["draft"],
};

/** The name an admin may see: Enrich tab lookups are named after the person looked up. */
function safeListName(list: { name: string; source: string } | null): string | null {
  if (!list) return null;
  return list.source === "manual" ? "Single lookup" : list.name;
}

async function loadTotals(admin: Admin, workspaceId: string, userId: string): Promise<Part<WorkspaceTotals>> {
  const totals: WorkspaceTotals = { lists: 0, drafts: 0, processed: 0, byPerson: 0, byPersonCredits: 0 };
  const PAGE = 1000;
  // PostgREST caps a response at 1000 rows: read every page so the totals are never cut short.
  for (let from = 0; from < 50 * PAGE; from += PAGE) {
    const { data, error } = await admin
      .from("lists")
      .select("id, status, processed_rows, created_by, credits_used")
      .eq("workspace_id", workspaceId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return fail(error);
    for (const list of data ?? []) {
      if (list.status === "draft") {
        totals.drafts += 1;
        continue;
      }
      totals.lists += 1;
      totals.processed += list.processed_rows;
      if (list.created_by === userId) {
        totals.byPerson += 1;
        totals.byPersonCredits += list.credits_used;
      }
    }
    if ((data ?? []).length < PAGE) break;
  }
  return ok(totals);
}

async function loadLists(admin: Admin, workspaceId: string, params: AccountDetailParams): Promise<Part<{ rows: AdminList[]; total: number }>> {
  const from = (params.listsPage - 1) * DETAIL_PAGE_SIZE;
  let query = admin
    .from("lists")
    .select(
      "id, name, status, pause_reason, source, source_detail, created_by, total_rows, processed_rows, found_work_email, found_personal_email, found_phone, not_found, credits_used, error, created_at, completed_at",
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId);
  if (params.source !== "all") query = query.eq("source", params.source);
  if (params.status !== "all") query = query.in("status", STATUS_GROUPS[params.status]);
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + DETAIL_PAGE_SIZE - 1);
  if (error) return fail(error);

  const creatorIds = [...new Set((data ?? []).map((l) => l.created_by))];
  const names = new Map<string, string | null>();
  if (creatorIds.length) {
    const { data: profiles, error: profilesError } = await admin.from("profiles").select("id, full_name, email").in("id", creatorIds);
    if (profilesError) return fail(profilesError);
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? p.email);
  }
  return ok({
    total: count ?? 0,
    rows: (data ?? []).map((l) => ({
      id: l.id,
      name: l.source === "manual" ? null : l.name,
      source: l.source,
      sourceDetail: l.source_detail,
      status: l.status,
      pauseReason: l.pause_reason,
      createdBy: l.created_by,
      createdByName: names.get(l.created_by) ?? null,
      totalRows: l.total_rows,
      processedRows: l.processed_rows,
      foundWorkEmail: l.found_work_email,
      foundPersonalEmail: l.found_personal_email,
      foundPhone: l.found_phone,
      notFound: l.not_found,
      creditsUsed: l.credits_used,
      error: l.error,
      createdAt: l.created_at,
      completedAt: l.completed_at,
    })),
  });
}

async function loadLedger(admin: Admin, workspaceId: string, page: number): Promise<Part<{ rows: AdminLedgerRow[]; total: number }>> {
  const from = (page - 1) * DETAIL_PAGE_SIZE;
  const { data, error, count } = await admin
    .from("credit_ledger")
    .select("id, created_at, kind, delta, note, list_id, list:lists(name, source)", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .neq("delta", 0) // zero-delta adjust rows are reconciliation notes, not activity
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + DETAIL_PAGE_SIZE - 1);
  if (error) return fail(error);
  return ok({
    total: count ?? 0,
    rows: (data ?? []).map((row) => {
      const usesList = row.kind === "consume" || row.kind === "overage";
      return {
        id: row.id,
        createdAt: row.created_at,
        kind: row.kind,
        delta: row.delta,
        note: row.note,
        listName: safeListName(row.list) ?? (usesList ? "Deleted list" : null),
      };
    }),
  });
}

async function loadGrants(admin: Admin, workspaceId: string): Promise<Part<AdminGrant[]>> {
  const { data, error } = await admin
    .from("credit_grants")
    .select("id, amount, remaining, source, note, granted_at, expires_at")
    .eq("workspace_id", workspaceId)
    .order("granted_at", { ascending: false })
    .limit(100);
  if (error) return fail(error);
  const now = Date.now();
  return ok(
    (data ?? []).map((g) => ({
      id: g.id,
      amount: g.amount,
      remaining: g.remaining,
      source: g.source,
      note: g.note,
      grantedAt: g.granted_at,
      expiresAt: g.expires_at,
      expired: new Date(g.expires_at).getTime() <= now,
    })),
  );
}

async function loadOverages(admin: Admin, workspaceId: string): Promise<Part<AdminOverage[]>> {
  const { data, error } = await admin
    .from("credit_overages")
    .select("id, created_at, credits, status, amount_cents, stripe_invoice_id, error")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail(error);
  return ok(
    (data ?? []).map((o) => ({
      id: o.id,
      createdAt: o.created_at,
      credits: o.credits,
      status: o.status,
      amountCents: o.amount_cents,
      stripeInvoiceId: o.stripe_invoice_id,
      error: o.error,
    })),
  );
}

async function loadMembers(admin: Admin, workspaceId: string): Promise<Part<AdminMember[]>> {
  const { data: members, error } = await admin.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", workspaceId).order("created_at");
  if (error) return fail(error);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return ok([]);
  // workspace_members.user_id points at auth.users, so profiles come from a second query.
  const { data: profiles, error: profilesError } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
  if (profilesError) return fail(profilesError);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return ok(
    (members ?? []).map((m) => ({
      userId: m.user_id,
      fullName: byId.get(m.user_id)?.full_name ?? null,
      email: byId.get(m.user_id)?.email ?? "",
      role: m.role,
      joinedAt: m.created_at,
    })),
  );
}

async function loadInvites(admin: Admin, workspaceId: string): Promise<Part<AdminInvite[]>> {
  const { data, error } = await admin
    .from("workspace_invites")
    .select("id, email, role, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail(error);
  return ok((data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at, expiresAt: i.expires_at })));
}

async function loadReferralCode(admin: Admin, workspaceId: string): Promise<AccountDetail["referralCode"]> {
  const [code, referrals] = await Promise.all([
    admin.from("referral_codes").select("code, click_count, revoked_at").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("referrals").select("status, reward_credits").eq("referrer_workspace_id", workspaceId).limit(1000),
  ]);
  if (code.error) return fail(code.error);
  if (referrals.error) return fail(referrals.error);
  if (!code.data) return ok(null);
  const rows = referrals.data ?? [];
  return ok({
    code: code.data.code,
    clicks: code.data.click_count,
    revoked: Boolean(code.data.revoked_at),
    signups: rows.filter((r) => r.status !== "rejected").length,
    rewarded: rows.filter((r) => r.status === "rewarded").length,
    rewardCredits: rows.reduce((sum, r) => sum + (r.status === "rewarded" ? (r.reward_credits ?? 0) : 0), 0),
  });
}

async function loadSameDomain(admin: Admin, userId: string, email: string): Promise<AccountDetail["sameDomain"]> {
  if (isFreeEmailDomain(email)) return ok(null);
  const domain = emailDomain(email);
  const pattern = `%@${domain.replace(/[\\%_]/g, (c) => `\\${c}`)}`;
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, created_at, onboarded_at")
    .ilike("email", pattern)
    .neq("id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return fail(error);
  return ok({
    domain,
    accounts: (data ?? []).map((p) => ({ userId: p.id, fullName: p.full_name, email: p.email, createdAt: p.created_at, onboarded: Boolean(p.onboarded_at) })),
  });
}

const EMPTY_WORKSPACE_PARTS = {
  available: ok(0),
  spend: ok(NO_SPEND),
  totals: ok<WorkspaceTotals>({ lists: 0, drafts: 0, processed: 0, byPerson: 0, byPersonCredits: 0 }),
  lists: ok<{ rows: AdminList[]; total: number }>({ rows: [], total: 0 }),
  grants: ok<AdminGrant[]>([]),
  ledger: ok<{ rows: AdminLedgerRow[]; total: number }>({ rows: [], total: 0 }),
  overspend: ok<WorkspaceOverspendState | null>(null),
  overages: ok<AdminOverage[]>([]),
  invoices: { state: "none" } as CustomerInvoices,
  members: ok<AdminMember[]>([]),
  invites: ok<AdminInvite[]>([]),
  referralCode: ok(null) as AccountDetail["referralCode"],
};

/** Everything the account detail page shows. Null when the account does not exist. */
export async function getAccountDetail(userId: string, params: AccountDetailParams): Promise<AccountDetail | null> {
  await assertAdmin();
  const admin = createAdminClient();

  const [profile, authUser, memberships, owned] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, created_at, onboarded_at, product_news, default_workspace_id, phone:profile_phones(phone, calls_allowed)")
      .eq("id", userId)
      .maybeSingle(),
    admin.auth.admin.getUserById(userId).catch(() => null),
    admin.from("workspace_members").select("role, workspace_id, workspace:workspaces(*)").eq("user_id", userId),
    // The internal outreach workspace has an owner but no member rows: include owned workspaces too.
    admin.from("workspaces").select("*").eq("owner_id", userId),
  ]);
  if (profile.error) throw new Error(profile.error.message);
  if (!profile.data) return null;
  if (memberships.error) throw new Error(memberships.error.message);
  if (owned.error) throw new Error(owned.error.message);
  const p = profile.data;

  const user = authUser && !authUser.error ? authUser.data.user : null;
  const lastSignInAt = user ? (user.last_sign_in_at ?? null) : undefined;
  const providers = user ? [...new Set([...(user.identities ?? []).map((i) => i.provider), ...((user.app_metadata?.providers as string[] | undefined) ?? [])])] : null;

  const memberRows = (memberships.data ?? []).filter((m) => m.workspace).map((m) => ({ role: m.role as string, workspace_id: m.workspace_id, workspace: m.workspace as WorkspaceRow }));
  const rows = [
    ...memberRows,
    ...(owned.data ?? []).filter((w) => !memberRows.some((m) => m.workspace_id === w.id)).map((w) => ({ role: "owner", workspace_id: w.id, workspace: w })),
  ];
  const current = (params.ws ? rows.find((m) => m.workspace_id === params.ws) : undefined) ?? rows.find((m) => m.workspace_id === p.default_workspace_id) ?? rows[0] ?? null;
  const workspace = current?.workspace ?? null;

  const person: AccountPerson = {
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    createdAt: p.created_at,
    onboardedAt: p.onboarded_at,
    productNews: p.product_news,
    phone: p.phone ? { phone: p.phone.phone, callsAllowed: p.phone.calls_allowed } : null,
    lastSignInAt,
    providers,
    stage: signupStage({ onboardedAt: p.onboarded_at, lastSignInAt }),
  };

  const personParts = Promise.all([
    // Presence of the click id is all the page needs: IP address and user agent stay unread.
    admin.from("meta_click_contexts").select("fbc, fbp, source, captured_at").eq("user_id", userId).maybeSingle(),
    admin
      .from("referrals")
      // Two links to workspaces: name the foreign key.
      .select("status, source, rejected_reason, signed_up_at, referrer:workspaces!referrals_referrer_workspace_id_fkey(id, name)")
      .eq("referred_user_id", userId)
      .maybeSingle(),
    admin.from("lead_shares").select("list_id, signed_up_at").eq("signed_up_user_id", userId).order("signed_up_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("mcp_connections").select("client_name, tool_calls, last_used_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("email_sends").select("id, kind, sent_at").eq("email", p.email).order("sent_at", { ascending: false }).limit(30),
    loadSameDomain(admin, userId, p.email),
  ]);

  const workspaceParts = workspace
    ? Promise.all([
        admin.rpc("credits_available", { ws: workspace.id }),
        loadSpend(admin, [workspace.id]),
        loadTotals(admin, workspace.id, userId),
        loadLists(admin, workspace.id, params),
        loadGrants(admin, workspace.id),
        loadLedger(admin, workspace.id, params.ledgerPage),
        workspaceOverspendState(admin, workspace.id).then(ok, (e: unknown) => fail(e instanceof Error ? e.message : "Overspend state could not be loaded")),
        loadOverages(admin, workspace.id),
        listCustomerInvoices(workspace.stripe_customer_id),
        loadMembers(admin, workspace.id),
        loadInvites(admin, workspace.id),
        loadReferralCode(admin, workspace.id),
      ])
    : null;

  const [[meta, referredBy, leadShare, mcp, emails, sameDomain], ws] = await Promise.all([personParts, workspaceParts]);

  const scoped = ws
    ? {
        available: ws[0].error ? fail(ws[0].error) : ok(ws[0].data ?? 0),
        spend: ws[1].error !== null ? fail(ws[1].error) : ok(ws[1].data.get(workspace!.id) ?? NO_SPEND),
        totals: ws[2],
        lists: ws[3],
        grants: ws[4],
        ledger: ws[5],
        overspend: ws[6] as Part<WorkspaceOverspendState | null>,
        overages: ws[7],
        invoices: ws[8],
        members: ws[9],
        invites: ws[10],
        referralCode: ws[11],
      }
    : EMPTY_WORKSPACE_PARTS;

  return {
    person,
    memberships: rows.map((m) => ({
      workspaceId: m.workspace_id,
      name: m.workspace.name,
      role: m.role,
      isDefault: m.workspace_id === p.default_workspace_id,
    })),
    workspace,
    role: current?.role ?? null,
    ...scoped,
    stripeUrl: workspace?.stripe_customer_id ? stripeCustomerUrl(workspace.stripe_customer_id) : null,
    meta: meta.error ? fail(meta.error) : ok({ attribution: metaAttribution(meta.data), source: meta.data?.source ?? null, capturedAt: meta.data?.captured_at ?? null }),
    referredBy: referredBy.error
      ? fail(referredBy.error)
      : ok(
          referredBy.data
            ? {
                workspaceId: referredBy.data.referrer?.id ?? null,
                workspaceName: referredBy.data.referrer?.name ?? "Deleted workspace",
                status: referredBy.data.status,
                source: referredBy.data.source,
                rejectedReason: referredBy.data.rejected_reason,
                signedUpAt: referredBy.data.signed_up_at,
              }
            : null,
        ),
    leadShare: leadShare.error ? fail(leadShare.error) : ok(leadShare.data ? { listId: leadShare.data.list_id, signedUpAt: leadShare.data.signed_up_at } : null),
    mcp: mcp.error ? fail(mcp.error) : ok((mcp.data ?? []).map((c) => ({ clientName: c.client_name, toolCalls: c.tool_calls, lastUsedAt: c.last_used_at, connectedAt: c.created_at }))),
    emails: emails.error ? fail(emails.error) : ok((emails.data ?? []).map((e) => ({ id: e.id, kind: e.kind, sentAt: e.sent_at }))),
    sameDomain,
  };
}

/** Name and email for the page title, without loading the whole page twice. */
export async function getAccountTitle(userId: string): Promise<string | null> {
  await assertAdmin();
  const { data } = await createAdminClient().from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return data ? (data.full_name ?? data.email) : null;
}
