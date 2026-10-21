import "server-only";

import type Stripe from "stripe";
import { sendEmail } from "@/lib/email/resend";
import { firstNameFor } from "@/lib/email/name";
import { OverspendChargedEmail } from "@/lib/email/templates/overspend-charged";
import { OverspendFailedEmail } from "@/lib/email/templates/overspend-failed";
import { formatUsdExact } from "@/lib/credits/money";
import {
  allocateCents,
  formatRate,
  MIN_INVOICE_CENTS,
  overspendAmountCents,
  overspendBudget,
  overspendRate,
  type OverspendIneligibleReason,
} from "@/lib/credits/overspend";
import { log, logError, type Admin } from "@/lib/jobs/shared";
import { notifyOps } from "@/lib/jobs/notify";
import { overspendChargedCopy, overspendFailedCopy } from "@/lib/notifications/copy";
import { notifyWorkspace } from "@/lib/notifications/emit";
import { INVOICE_FOOTER, stripe } from "@/lib/stripe/client";
import { isOverspendInvoice, OVERSPEND_INVOICE_KIND } from "@/lib/stripe/webhooks";
import type { Tables } from "@/lib/supabase/types";

/**
 * Overspend, server side: eligibility, the per-workspace state the engine
 * reads every tick, invoicing of pending overage rows (one invoice per
 * workspace when a list finishes), payment retries and the webhook hooks.
 * Money is never taken without a confirmed opt-in (`overspend_enabled_by`).
 */

export { isOverspendInvoice, OVERSPEND_INVOICE_KIND };
/** Pending rows older than this are invoiced by the daily sweep even if the list still runs. */
export const SWEEP_PENDING_HOURS = 24;
/** A failed invoice is retried daily for this long, then ops is alerted. */
export const RETRY_DAYS = 7;

type WorkspaceRow = Tables<"workspaces">;
type OverageRow = Tables<"credit_overages">;

const SUBSCRIPTION_RUNNING = new Set(["active", "trialing"]);

/** Eligibility from database fields alone (no Stripe call): used by the engine and the start flow. */
export function overspendEligibility(ws: Pick<WorkspaceRow, "kind" | "plan_key" | "stripe_subscription_id" | "subscription_status">): { eligible: true } | { eligible: false; reason: OverspendIneligibleReason } {
  if (ws.kind === "internal") return { eligible: false, reason: "internal" };
  if (!ws.plan_key) return { eligible: false, reason: "trial" };
  if (!ws.stripe_subscription_id || !SUBSCRIPTION_RUNNING.has(ws.subscription_status ?? "")) return { eligible: false, reason: "no_subscription" };
  return { eligible: true };
}

export interface WorkspaceOverspendState {
  workspaceId: string;
  enabled: boolean;
  /** Opted in, on a running plan, not blocked by a failed payment. */
  active: boolean;
  ineligibleReason: OverspendIneligibleReason | null;
  blockedReason: "payment_failed" | null;
  limit: number | null;
  used: number;
  /** Credits still allowed this month (Infinity without a limit, 0 when not active). */
  budget: number;
  planKey: string | null;
}

const WS_FIELDS = "id, kind, plan_key, stripe_subscription_id, subscription_status, overspend_enabled, overspend_monthly_limit, overspend_blocked_reason" as const;

function toState(ws: Pick<WorkspaceRow, "id" | "kind" | "plan_key" | "stripe_subscription_id" | "subscription_status" | "overspend_enabled" | "overspend_monthly_limit" | "overspend_blocked_reason">, used: number): WorkspaceOverspendState {
  const eligibility = overspendEligibility(ws);
  const blockedReason = (ws.overspend_blocked_reason as "payment_failed" | null) ?? null;
  const active = ws.overspend_enabled && eligibility.eligible && !blockedReason;
  return {
    workspaceId: ws.id,
    enabled: ws.overspend_enabled,
    active,
    ineligibleReason: eligibility.eligible ? null : eligibility.reason,
    blockedReason,
    limit: ws.overspend_monthly_limit,
    used,
    budget: overspendBudget({ eligible: active, limit: ws.overspend_monthly_limit, used }),
    planKey: ws.plan_key,
  };
}

/** One state per workspace for the engine tick (one query plus one RPC per opted-in workspace). */
export async function workspaceOverspendStates(admin: Admin, ids: readonly string[]): Promise<Map<string, WorkspaceOverspendState>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, WorkspaceOverspendState>();
  if (unique.length === 0) return out;
  const { data } = await admin.from("workspaces").select(WS_FIELDS).in("id", unique);
  for (const ws of data ?? []) {
    let used = 0;
    if (ws.overspend_enabled && ws.overspend_monthly_limit != null) {
      const { data: sum } = await admin.rpc("overspend_used_this_month", { ws: ws.id });
      used = sum ?? 0;
    }
    out.set(ws.id, toState(ws, used));
  }
  return out;
}

export async function workspaceOverspendState(admin: Admin, workspaceId: string): Promise<WorkspaceOverspendState | null> {
  const { data: ws } = await admin.from("workspaces").select(WS_FIELDS).eq("id", workspaceId).maybeSingle();
  if (!ws) return null;
  const { data: sum } = await admin.rpc("overspend_used_this_month", { ws: ws.id });
  return toState(ws, sum ?? 0);
}

/* ----------------------------------------------------------- payment method */

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
}

/** The card the subscription (or, failing that, the customer) charges automatically. Null when none is on file. */
export async function paymentMethodSummary(ws: Pick<WorkspaceRow, "stripe_subscription_id" | "stripe_customer_id">): Promise<PaymentMethodSummary | null> {
  const pm = await resolvePaymentMethod(ws);
  if (!pm) return null;
  const card = pm.card;
  if (card) return { brand: card.display_brand ?? card.brand, last4: card.last4 };
  return { brand: pm.type.replace(/_/g, " "), last4: "" };
}

async function resolvePaymentMethod(ws: Pick<WorkspaceRow, "stripe_subscription_id" | "stripe_customer_id">): Promise<Stripe.PaymentMethod | null> {
  try {
    if (ws.stripe_subscription_id) {
      const sub = await stripe().subscriptions.retrieve(ws.stripe_subscription_id, { expand: ["default_payment_method"] });
      if (sub.default_payment_method && typeof sub.default_payment_method !== "string") return sub.default_payment_method;
    }
    if (ws.stripe_customer_id) {
      const customer = await stripe().customers.retrieve(ws.stripe_customer_id, { expand: ["invoice_settings.default_payment_method"] });
      if (!customer.deleted) {
        const pm = customer.invoice_settings?.default_payment_method;
        if (pm && typeof pm !== "string") return pm;
      }
    }
  } catch (error) {
    if ((error as { code?: string }).code !== "resource_missing") throw error;
  }
  return null;
}

/* ---------------------------------------------------------------- invoicing */

export type InvoiceOutcome =
  | { status: "nothing" }
  | { status: "carried"; credits: number; amountCents: number }
  | { status: "paid"; invoiceId: string; amountCents: number; credits: number }
  | { status: "action_required" | "failed"; invoiceId: string | null; amountCents: number; credits: number; error: string | null };

interface ListGroup {
  listId: string;
  name: string;
  credits: number;
  amountCents: number;
  rows: OverageRow[];
}

function groupByList(rows: OverageRow[], names: Map<string, string>, fallbackPlan: string | null): ListGroup[] {
  const groups = new Map<string, ListGroup>();
  for (const row of rows) {
    const g = groups.get(row.list_id) ?? { listId: row.list_id, name: names.get(row.list_id) ?? "Enrichment", credits: 0, amountCents: 0, rows: [] };
    g.credits += row.credits;
    // Rows settled after a plan change keep their own plan; a missing plan falls back to the workspace plan, then the list price (Preb 1k).
    g.amountCents += overspendAmountCents(row.credits, row.plan_key ?? fallbackPlan ?? "p2_1k_m");
    g.rows.push(row);
    groups.set(row.list_id, g);
  }
  return [...groups.values()];
}

function itemDescription(g: ListGroup): string {
  const keys = new Set(g.rows.map((r) => r.plan_key).filter(Boolean));
  const rate = keys.size === 1 ? overspendRate([...keys][0]) : null;
  const n = g.credits.toLocaleString("en-US");
  return `${g.name}: ${n} ${g.credits === 1 ? "credit" : "credits"} beyond your balance${rate ? ` at ${formatRate(rate)} per credit` : ""}`;
}

/**
 * Invoice every pending overage row of a workspace and charge the payment
 * method on file. Called when a list finishes (`finalizeList`) and by the
 * daily sweep. Never throws; rows never stay in `invoicing`.
 */
export async function invoicePendingOverspend(admin: Admin, workspaceId: string, trigger: "list_finished" | "sweep" | "manual"): Promise<InvoiceOutcome> {
  // Atomic claim so a concurrent tick cannot invoice the same rows twice.
  const { data: rows } = await admin
    .from("credit_overages")
    .update({ status: "invoicing" })
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .select("*");
  if (!rows || rows.length === 0) return { status: "nothing" };
  const ids = rows.map((r) => r.id);
  const revert = async () => {
    await admin.from("credit_overages").update({ status: "pending" }).in("id", ids);
  };

  try {
    const { data: ws } = await admin
      .from("workspaces")
      .select("id, name, owner_id, plan_key, stripe_customer_id, stripe_subscription_id, subscription_status, kind")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!ws || ws.kind === "internal") {
      await revert();
      return { status: "nothing" };
    }
    const { data: lists } = await admin.from("lists").select("id, name").in("id", [...new Set(rows.map((r) => r.list_id))]);
    const names = new Map((lists ?? []).map((l) => [l.id, l.name]));
    const groups = groupByList(rows, names, ws.plan_key);
    const credits = groups.reduce((s, g) => s + g.credits, 0);
    const amountCents = groups.reduce((s, g) => s + g.amountCents, 0);

    if (amountCents < MIN_INVOICE_CENTS) {
      // Below Stripe's minimum charge: carry over to the next invoice.
      await revert();
      log("overspend.carried", { workspaceId, credits, amountCents, trigger });
      return { status: "carried", credits, amountCents };
    }

    const customerId = ws.stripe_customer_id;
    const pm = customerId ? await resolvePaymentMethod(ws) : null;
    if (!customerId || !pm) {
      await markFailed(admin, rows, null, "No payment method on file", amountCents);
      await blockWorkspace(admin, ws.id);
      await notifyFailed(admin, ws, { credits, amountCents, actionRequired: false, invoiceUrl: null });
      return { status: "failed", invoiceId: null, amountCents, credits, error: "no_payment_method" };
    }

    const invoice = await stripe().invoices.create({
      customer: customerId,
      collection_method: "charge_automatically",
      auto_advance: false,
      pending_invoice_items_behavior: "exclude",
      default_payment_method: pm.id,
      description: "Preb overspend: credits enriched beyond your balance",
      footer: INVOICE_FOOTER,
      metadata: { app: "preb", preb_kind: OVERSPEND_INVOICE_KIND, workspace_id: ws.id, trigger, overage_ids: ids.join(",").slice(0, 500) },
    });
    for (const g of groups) {
      await stripe().invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: g.amountCents,
        currency: "usd",
        description: itemDescription(g),
        metadata: { list_id: g.listId, credits: String(g.credits) },
      });
    }
    // Per-row amounts for the ledger view (sum matches the invoice total).
    for (const g of groups) {
      const parts = allocateCents(g.rows, g.amountCents);
      await Promise.all(g.rows.map((r, i) => admin.from("credit_overages").update({ amount_cents: parts[i], stripe_invoice_id: invoice.id, invoiced_at: new Date().toISOString() }).eq("id", r.id)));
    }
    await stripe().invoices.finalizeInvoice(invoice.id);

    const outcome = await payInvoice(invoice.id);
    if (outcome.status === "paid") {
      await admin.from("credit_overages").update({ status: "paid", paid_at: new Date().toISOString(), error: null }).in("id", ids);
      log("overspend.paid", { workspaceId, invoiceId: invoice.id, credits, amountCents, trigger });
      await notifyCharged(admin, ws, { credits, amountCents, groups, invoiceUrl: outcome.invoice.hosted_invoice_url ?? null });
      return { status: "paid", invoiceId: invoice.id, amountCents, credits };
    }
    await markFailed(admin, rows, invoice.id, outcome.error, amountCents, outcome.status);
    await blockWorkspace(admin, ws.id);
    await notifyFailed(admin, ws, { credits, amountCents, actionRequired: outcome.status === "action_required", invoiceUrl: outcome.invoice?.hosted_invoice_url ?? null });
    return { status: outcome.status, invoiceId: invoice.id, amountCents, credits, error: outcome.error };
  } catch (error) {
    // Stripe or database trouble before the invoice existed: give the rows back.
    logError("overspend.invoice_failed", error, { workspaceId, trigger });
    const { data: still } = await admin.from("credit_overages").select("id, stripe_invoice_id").in("id", ids).eq("status", "invoicing");
    const unlinked = (still ?? []).filter((r) => !r.stripe_invoice_id).map((r) => r.id);
    if (unlinked.length) await admin.from("credit_overages").update({ status: "pending" }).in("id", unlinked);
    const linked = (still ?? []).filter((r) => r.stripe_invoice_id).map((r) => r.id);
    if (linked.length) await admin.from("credit_overages").update({ status: "failed", failed_at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) }).in("id", linked);
    return { status: "failed", invoiceId: null, amountCents: 0, credits: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

type PayOutcome = { status: "paid"; invoice: Stripe.Invoice } | { status: "action_required" | "failed"; invoice: Stripe.Invoice | null; error: string | null };

/**
 * Charge the invoice off-session. A decline or a 3-D Secure request comes back
 * as an error from Stripe. `paymentMethod` overrides the card the invoice was
 * created with (retries after the customer changed the card).
 */
async function payInvoice(invoiceId: string, paymentMethod?: string): Promise<PayOutcome> {
  try {
    const paid = await stripe().invoices.pay(invoiceId, { off_session: true, ...(paymentMethod ? { payment_method: paymentMethod } : {}) });
    if (paid.status === "paid") return { status: "paid", invoice: paid };
    return { status: "failed", invoice: paid, error: `invoice status ${paid.status}` };
  } catch (error) {
    const e = error as { code?: string; decline_code?: string; message?: string; type?: string };
    const invoice = await stripe().invoices.retrieve(invoiceId).catch(() => null);
    const actionRequired = e.code === "invoice_payment_intent_requires_action" || e.code === "authentication_required" || e.code === "payment_intent_action_required";
    return { status: actionRequired ? "action_required" : "failed", invoice, error: actionRequired ? "authentication_required" : e.decline_code || e.code || e.message || "payment_failed" };
  }
}

async function markFailed(admin: Admin, rows: Pick<OverageRow, "id" | "credits">[], invoiceId: string | null, error: string | null, amountCents: number, status: "failed" | "action_required" = "failed") {
  // Without an invoice the per-row amounts are allocated here; with one they were set when the items were created.
  const parts = invoiceId ? null : allocateCents(rows, amountCents);
  await Promise.all(
    rows.map((r, i) =>
      admin
        .from("credit_overages")
        .update({ status, failed_at: new Date().toISOString(), error, ...(parts ? { amount_cents: parts[i] } : {}) })
        .eq("id", r.id),
    ),
  );
}

async function blockWorkspace(admin: Admin, workspaceId: string) {
  await admin.from("workspaces").update({ overspend_blocked_reason: "payment_failed", overspend_blocked_at: new Date().toISOString() }).eq("id", workspaceId).is("overspend_blocked_reason", null);
}

async function unblockWorkspace(admin: Admin, workspaceId: string) {
  const { count } = await admin.from("credit_overages").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["failed", "action_required"]);
  if ((count ?? 0) > 0) return;
  await admin.from("workspaces").update({ overspend_blocked_reason: null, overspend_blocked_at: null }).eq("id", workspaceId);
}

/* ------------------------------------------------------------ notifications */

type WsForMail = { id: string; name: string; owner_id: string; plan_key: string | null };

async function owner(admin: Admin, ws: WsForMail): Promise<{ email: string; firstName: string } | null> {
  const { data } = await admin.from("profiles").select("email, full_name").eq("id", ws.owner_id).maybeSingle();
  return data?.email ? { email: data.email, firstName: firstNameFor(data.full_name, data.email) } : null;
}

async function notifyCharged(admin: Admin, ws: WsForMail, input: { credits: number; amountCents: number; groups: ListGroup[]; invoiceUrl: string | null }) {
  const listNames = input.groups.map((g) => g.name);
  await notifyWorkspace(admin, ws.id, overspendChargedCopy({ credits: input.credits, amountCents: input.amountCents, listNames }), { roles: ["owner", "admin"] });
  try {
    const to = await owner(admin, ws);
    if (!to) return;
    const keys = new Set(input.groups.flatMap((g) => g.rows.map((r) => r.plan_key)).filter(Boolean));
    const rate = overspendRate(keys.size === 1 ? [...keys][0] : ws.plan_key);
    await sendEmail({
      to: to.email,
      kind: "overspend_charged",
      workspaceId: ws.id,
      subject: `${formatUsdExact(input.amountCents)} charged for credits beyond your balance`,
      react: OverspendChargedEmail({
        firstName: to.firstName,
        workspaceName: ws.name,
        credits: input.credits,
        amount: formatUsdExact(input.amountCents),
        rate: rate ? formatRate(rate) : "the plan rate",
        lists: input.groups.map((g) => ({ name: g.name, credits: g.credits })),
        invoiceUrl: input.invoiceUrl,
      }),
    });
  } catch (error) {
    logError("overspend.charged_email_failed", error, { workspaceId: ws.id });
  }
}

async function notifyFailed(admin: Admin, ws: WsForMail, input: { credits: number; amountCents: number; actionRequired: boolean; invoiceUrl: string | null }) {
  await notifyWorkspace(admin, ws.id, overspendFailedCopy({ amountCents: input.amountCents, actionRequired: input.actionRequired }), { roles: ["owner", "admin"] });
  try {
    const to = await owner(admin, ws);
    if (!to) return;
    await sendEmail({
      to: to.email,
      kind: "overspend_failed",
      workspaceId: ws.id,
      subject: input.actionRequired ? "Please confirm your overspend payment" : "Your overspend payment did not go through",
      react: OverspendFailedEmail({
        firstName: to.firstName,
        workspaceName: ws.name,
        credits: input.credits,
        amount: formatUsdExact(input.amountCents),
        actionRequired: input.actionRequired,
        invoiceUrl: input.invoiceUrl,
      }),
    });
  } catch (error) {
    logError("overspend.failed_email_failed", error, { workspaceId: ws.id });
  }
}

/* ------------------------------------------------------------------ retries */

export type RetryOutcome = { status: "paid" } | { status: "action_required"; url: string | null } | { status: "failed"; error: string | null } | { status: "nothing" };

/** Pay the newest unpaid overspend invoice again (Billing page button and the daily sweep). */
export async function retryOverspendPayment(admin: Admin, workspaceId: string, notify = true): Promise<RetryOutcome> {
  const { data: rows } = await admin
    .from("credit_overages")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["failed", "action_required"])
    .not("stripe_invoice_id", "is", null)
    .order("failed_at", { ascending: false });
  const invoiceId = rows?.[0]?.stripe_invoice_id;
  if (!invoiceId) return { status: "nothing" };
  const ids = (rows ?? []).filter((r) => r.stripe_invoice_id === invoiceId).map((r) => r.id);
  // The card may have changed since the invoice was created: charge the one on the subscription now.
  const { data: wsCard } = await admin.from("workspaces").select("stripe_subscription_id, stripe_customer_id").eq("id", workspaceId).maybeSingle();
  const pm = wsCard ? await resolvePaymentMethod(wsCard).catch(() => null) : null;
  const outcome = await payInvoice(invoiceId, pm?.id);
  if (outcome.status === "paid") {
    await markOverspendInvoicePaid(admin, invoiceId, outcome.invoice);
    return { status: "paid" };
  }
  await admin.from("credit_overages").update({ status: outcome.status, failed_at: new Date().toISOString(), error: outcome.error }).in("id", ids);
  if (notify) {
    const { data: ws } = await admin.from("workspaces").select("id, name, owner_id, plan_key").eq("id", workspaceId).maybeSingle();
    const credits = (rows ?? []).filter((r) => r.stripe_invoice_id === invoiceId).reduce((s, r) => s + r.credits, 0);
    const amountCents = outcome.invoice?.amount_due ?? (rows ?? []).filter((r) => r.stripe_invoice_id === invoiceId).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    if (ws) await notifyFailed(admin, ws, { credits, amountCents, actionRequired: outcome.status === "action_required", invoiceUrl: outcome.invoice?.hosted_invoice_url ?? null });
  }
  return outcome.status === "action_required" ? { status: "action_required", url: outcome.invoice?.hosted_invoice_url ?? null } : { status: "failed", error: outcome.error };
}

/* ------------------------------------------------------------------ webhook */

/** `invoice.paid` for an overspend invoice (also the sync path after `invoices.pay`): rows paid, block lifted. Idempotent. */
export async function markOverspendInvoicePaid(admin: Admin, invoiceId: string, invoice: Stripe.Invoice | null = null): Promise<void> {
  const { data: rows } = await admin
    .from("credit_overages")
    .update({ status: "paid", paid_at: new Date().toISOString(), error: null })
    .eq("stripe_invoice_id", invoiceId)
    .neq("status", "paid")
    .select("workspace_id, credits, amount_cents, list_id");
  if (!rows || rows.length === 0) return;
  const workspaceId = rows[0].workspace_id;
  await unblockWorkspace(admin, workspaceId);
  log("overspend.invoice_paid", { workspaceId, invoiceId, rows: rows.length });
  // A payment that only succeeded on retry or on the hosted page still deserves the receipt.
  const { data: ws } = await admin.from("workspaces").select("id, name, owner_id, plan_key").eq("id", workspaceId).maybeSingle();
  if (!ws) return;
  const { data: lists } = await admin.from("lists").select("id, name").in("id", [...new Set(rows.map((r) => r.list_id))]);
  const names = new Map((lists ?? []).map((l) => [l.id, l.name]));
  const groups = new Map<string, ListGroup>();
  for (const r of rows) {
    const g = groups.get(r.list_id) ?? { listId: r.list_id, name: names.get(r.list_id) ?? "Enrichment", credits: 0, amountCents: 0, rows: [] };
    g.credits += r.credits;
    g.amountCents += r.amount_cents ?? 0;
    groups.set(r.list_id, g);
  }
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  const amountCents = invoice?.amount_paid ?? rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  await notifyCharged(admin, ws, { credits, amountCents, groups: [...groups.values()], invoiceUrl: invoice?.hosted_invoice_url ?? null });
}

/** `invoice.payment_failed` for an overspend invoice (a Stripe-side retry failed). */
export async function markOverspendInvoiceFailed(admin: Admin, invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.id) return;
  const { data: rows } = await admin
    .from("credit_overages")
    .update({ status: "failed", failed_at: new Date().toISOString(), error: "payment_failed" })
    .eq("stripe_invoice_id", invoice.id)
    .in("status", ["invoicing", "action_required", "failed"])
    .select("workspace_id");
  if (!rows || rows.length === 0) return;
  await blockWorkspace(admin, rows[0].workspace_id);
  log("overspend.invoice_payment_failed", { workspaceId: rows[0].workspace_id, invoiceId: invoice.id });
}

/* -------------------------------------------------------------------- sweep */

export interface SweepSummary {
  unstuck: number;
  invoiced: number;
  retried: number;
  alerted: number;
}

/** Daily: free stuck rows, invoice old pending overspend, retry unpaid invoices, alert ops after RETRY_DAYS. */
export async function sweepOverspend(admin: Admin): Promise<SweepSummary> {
  const summary: SweepSummary = { unstuck: 0, invoiced: 0, retried: 0, alerted: 0 };
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data: stuck } = await admin
    .from("credit_overages")
    .update({ status: "pending" })
    .eq("status", "invoicing")
    .is("stripe_invoice_id", null)
    .lt("created_at", hourAgo)
    .select("id");
  summary.unstuck = stuck?.length ?? 0;

  const cutoff = new Date(Date.now() - SWEEP_PENDING_HOURS * 3_600_000).toISOString();
  const { data: pending } = await admin.from("credit_overages").select("workspace_id").eq("status", "pending").lt("created_at", cutoff);
  for (const wsId of new Set((pending ?? []).map((r) => r.workspace_id))) {
    const outcome = await invoicePendingOverspend(admin, wsId, "sweep");
    if (outcome.status === "paid" || outcome.status === "failed" || outcome.status === "action_required") summary.invoiced += 1;
  }

  const { data: unpaid } = await admin
    .from("credit_overages")
    .select("workspace_id, stripe_invoice_id, failed_at, invoiced_at, amount_cents")
    .in("status", ["failed", "action_required"])
    .not("stripe_invoice_id", "is", null);
  const byWorkspace = new Map<string, { invoiceId: string; since: string; amount: number }>();
  for (const r of unpaid ?? []) {
    const since = r.invoiced_at ?? r.failed_at ?? new Date().toISOString();
    const cur = byWorkspace.get(r.workspace_id);
    if (!cur || since < cur.since) byWorkspace.set(r.workspace_id, { invoiceId: r.stripe_invoice_id!, since, amount: r.amount_cents ?? 0 });
  }
  for (const [wsId, info] of byWorkspace) {
    const ageDays = (Date.now() - new Date(info.since).getTime()) / 86_400_000;
    if (ageDays > RETRY_DAYS) {
      summary.alerted += 1;
      await notifyOps("Overspend invoice unpaid for more than a week", [`workspace_id: ${wsId}`, `invoice: ${info.invoiceId}`, `unpaid since: ${info.since}`, "Overspend is blocked for this workspace until it is paid."]);
      continue;
    }
    const outcome = await retryOverspendPayment(admin, wsId, false);
    if (outcome.status !== "nothing") summary.retried += 1;
  }
  return summary;
}
