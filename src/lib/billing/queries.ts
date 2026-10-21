import "server-only";

import { createClient } from "@/utils/supabase/server";
import { getPlan, type Plan } from "@/lib/credits/plans";
import { getCataloguePlan, type CataloguePlan } from "@/lib/stripe/catalogue";
import { activeSubscriptionId } from "@/lib/stripe/subscription";
import { stripe } from "@/lib/stripe/client";
import { formatRate, overspendAmountCents, overspendRate, type OverspendIneligibleReason } from "@/lib/credits/overspend";
import { paymentMethodSummary, workspaceOverspendState, type PaymentMethodSummary } from "./overspend";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionContext } from "@/lib/supabase/queries";
import type { Tables } from "@/lib/supabase/types";

export interface GrantSummary {
  id: string;
  amount: number;
  remaining: number;
  expiresAt: string;
  source: Tables<"credit_grants">["source"];
  note: string | null;
}

export interface LedgerEntry {
  id: number;
  createdAt: string;
  kind: Tables<"credit_ledger">["kind"];
  delta: number;
  note: string | null;
  listName: string | null;
  listId: string | null;
}

export interface BillingOverview {
  role: SessionContext["role"];
  canManage: boolean;
  available: number;
  isTrial: boolean;
  hasCustomer: boolean;
  plan: (Plan & Partial<Pick<CataloguePlan, "priceCents">>) | null;
  subscription: { status: string | null; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
  grants: GrantSummary[];
  ledger: LedgerEntry[];
}

export const LEDGER_PAGE = 50;

/** Everything the Billing settings page shows. Reads through RLS (members may see; owners/admins manage). */
export async function getBillingOverview(session: SessionContext): Promise<BillingOverview> {
  const supabase = await createClient();
  const ws = session.workspace;
  const [{ data: available }, { data: grants }, { data: ledger }] = await Promise.all([
    supabase.rpc("credits_available", { ws: ws.id }),
    supabase
      .from("credit_grants")
      .select("id, amount, remaining, expires_at, source, note")
      .eq("workspace_id", ws.id)
      .gt("remaining", 0)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true }),
    supabase
      .from("credit_ledger")
      .select("id, created_at, kind, delta, note, list_id, list:lists(name)")
      .eq("workspace_id", ws.id)
      .neq("delta", 0) // zero-delta adjust rows are reconciliation notes, not activity
      .order("created_at", { ascending: false })
      .limit(LEDGER_PAGE),
  ]);

  // A subscription stored by the other Stripe mode (dev and prod share the
  // database) does not exist for this key: show the workspace as plan-less.
  let foreignSubscription = false;
  if (ws.stripe_subscription_id && ws.subscription_status !== "canceled") {
    try {
      foreignSubscription = !(await activeSubscriptionId(ws));
    } catch {
      // Stripe unreachable: show what the database says.
    }
  }
  const planKey = foreignSubscription ? null : ws.plan_key;

  const base = getPlan(planKey);
  let plan: BillingOverview["plan"] = base ?? null;
  if (base) {
    try {
      const live = await getCataloguePlan(base.key);
      if (live) plan = live;
    } catch {
      // Stripe unreachable: show the plan without a price.
    }
  }

  return {
    role: session.role,
    canManage: session.role !== "member",
    available: available ?? 0,
    isTrial: !planKey,
    hasCustomer: Boolean(ws.stripe_customer_id),
    plan,
    subscription: ws.stripe_subscription_id && !foreignSubscription
      ? { status: ws.subscription_status, cancelAtPeriodEnd: ws.cancel_at_period_end, currentPeriodEnd: ws.current_period_end }
      : null,
    grants: (grants ?? []).map((g) => ({ id: g.id, amount: g.amount, remaining: g.remaining, expiresAt: g.expires_at, source: g.source, note: g.note })),
    ledger: (ledger ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      kind: row.kind,
      delta: row.delta,
      note: row.note,
      listId: row.list_id,
      listName: (row.list as { name: string } | null)?.name ?? null,
    })),
  };
}

/* ----------------------------------------------------------------- overspend */

export interface OverspendOverview {
  canManage: boolean;
  enabled: boolean;
  /** Opted in, running plan, not blocked: lists may overspend right now. */
  active: boolean;
  ineligibleReason: OverspendIneligibleReason | null;
  blockedReason: "payment_failed" | null;
  limit: number | null;
  usedThisMonth: number;
  usedAmountCents: number;
  /** Formatted per-credit price of the current plan, e.g. "$0.037"; null without a plan. */
  rate: string | null;
  plan: { credits: number; priceCents: number } | null;
  card: PaymentMethodSummary | null;
  /** The unpaid overspend invoice behind a block, if any. */
  unpaid: { invoiceId: string; amountCents: number; credits: number; actionRequired: boolean; hostedUrl: string | null } | null;
  enabledAt: string | null;
}

/** Everything the Overspend section of Settings › Billing shows. */
export async function getOverspendOverview(session: SessionContext): Promise<OverspendOverview> {
  const ws = session.workspace;
  const admin = createAdminClient();
  const supabase = await createClient();
  const [state, { data: monthRows }, { data: unpaidRows }] = await Promise.all([
    workspaceOverspendState(admin, ws.id),
    supabase
      .from("credit_overages")
      .select("credits, amount_cents, plan_key")
      .eq("workspace_id", ws.id)
      .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()),
    supabase.from("credit_overages").select("credits, amount_cents, stripe_invoice_id, status").eq("workspace_id", ws.id).in("status", ["failed", "action_required"]).not("stripe_invoice_id", "is", null),
  ]);
  const rate = overspendRate(ws.plan_key);
  const usedThisMonth = (monthRows ?? []).reduce((s, r) => s + r.credits, 0);
  const usedAmountCents = (monthRows ?? []).reduce((s, r) => s + (r.amount_cents ?? overspendAmountCents(r.credits, r.plan_key ?? ws.plan_key)), 0);

  let card: PaymentMethodSummary | null = null;
  if (state && !state.ineligibleReason) {
    try {
      card = await paymentMethodSummary(ws);
    } catch {
      // Stripe unreachable: the section still renders.
    }
  }

  let unpaid: OverspendOverview["unpaid"] = null;
  const first = unpaidRows?.[0];
  if (first?.stripe_invoice_id) {
    const rows = (unpaidRows ?? []).filter((r) => r.stripe_invoice_id === first.stripe_invoice_id);
    let hostedUrl: string | null = null;
    let amountCents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    try {
      const invoice = await stripe().invoices.retrieve(first.stripe_invoice_id);
      hostedUrl = invoice.hosted_invoice_url ?? null;
      amountCents = invoice.amount_due || amountCents;
    } catch {
      // Keep the stored amounts.
    }
    unpaid = { invoiceId: first.stripe_invoice_id, amountCents, credits: rows.reduce((s, r) => s + r.credits, 0), actionRequired: first.status === "action_required", hostedUrl };
  }

  return {
    canManage: session.role !== "member",
    enabled: ws.overspend_enabled,
    active: state?.active ?? false,
    ineligibleReason: state?.ineligibleReason ?? (!state ? "no_subscription" : null),
    blockedReason: state?.blockedReason ?? null,
    limit: ws.overspend_monthly_limit,
    usedThisMonth,
    usedAmountCents,
    rate: rate ? formatRate(rate) : null,
    plan: (() => {
      const plan = getPlan(ws.plan_key);
      return plan ? { credits: plan.credits, priceCents: plan.priceCents } : null;
    })(),
    card: card && (!state?.ineligibleReason ? card : null),
    unpaid,
    enabledAt: ws.overspend_enabled_at,
  };
}

/** What the Configure step and the Enrich tab need to decide whether a short list may start. */
export interface OverspendStart {
  enabled: boolean;
  active: boolean;
  canManage: boolean;
  /** Formatted per-credit price, null without a plan. */
  rate: string | null;
  centsPerCredit: number | null;
  /** Credits left under the monthly limit; null without a limit. */
  remaining: number | null;
  creditsAvailable: number;
}

export async function getOverspendStart(session: SessionContext): Promise<OverspendStart> {
  const admin = createAdminClient();
  const [state, { data: available }] = await Promise.all([workspaceOverspendState(admin, session.workspace.id), (await createClient()).rpc("credits_available", { ws: session.workspace.id })]);
  const rate = overspendRate(session.workspace.plan_key);
  return {
    enabled: session.workspace.overspend_enabled,
    active: state?.active ?? false,
    canManage: session.role !== "member",
    rate: rate ? formatRate(rate) : null,
    centsPerCredit: rate?.centsPerCredit ?? null,
    remaining: state && state.limit != null ? Math.max(0, state.limit - state.used) : null,
    creditsAvailable: available ?? 0,
  };
}
