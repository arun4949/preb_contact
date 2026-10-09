import type Stripe from "stripe";
import { grantExpiry, type Plan } from "@/lib/credits/plans";

/**
 * Pure helpers for the Stripe webhook (unit-tested; no I/O). The route
 * resolves prices to plans and passes the results in.
 */

export const STRIPE_PROVIDER = "stripe";

/** Events the endpoint subscribes to (also used by `scripts/stripe-webhook.ts`). */
export const STRIPE_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

export type GrantReason = "subscription_create" | "subscription_cycle" | "subscription_update";

export interface InvoiceLineSummary {
  priceId: string | null;
  amount: number;
}

export function invoiceLines(invoice: Stripe.Invoice): InvoiceLineSummary[] {
  return (invoice.lines?.data ?? []).map((line) => ({
    priceId: line.pricing?.price_details?.price ? String(line.pricing.price_details.price) : null,
    amount: line.amount,
  }));
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export function invoiceWorkspaceId(invoice: Stripe.Invoice): string | null {
  return invoice.parent?.subscription_details?.metadata?.workspace_id ?? null;
}

export function customerIdOf(obj: { customer: string | Stripe.Customer | Stripe.DeletedCustomer | null }): string | null {
  const c = obj.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

export interface GrantDecision {
  credits: number;
  plan: Plan;
  expiresAt: Date;
  note: string;
}

/**
 * How many credits an invoice earns:
 * - subscription_create / subscription_cycle: the plan's full credits;
 * - subscription_update (upgrade, invoiced immediately): the difference
 *   between the plans on the positive lines and the plans on the negative
 *   (unused-time) lines; downgrades earn nothing.
 */
export function decideGrant(
  billingReason: string | null,
  lines: InvoiceLineSummary[],
  planOf: (priceId: string) => Plan | null,
  now = new Date(),
): GrantDecision | null {
  if (billingReason === "subscription_create" || billingReason === "subscription_cycle") {
    const line = lines.find((l) => l.priceId && l.amount >= 0 && planOf(l.priceId));
    const plan = line?.priceId ? planOf(line.priceId) : null;
    if (!plan) return null;
    return {
      credits: plan.credits,
      plan,
      expiresAt: grantExpiry(plan.interval, now),
      note: `${plan.name} · ${plan.interval === "year" ? "annual" : "monthly"}${billingReason === "subscription_cycle" ? " renewal" : ""}`,
    };
  }
  if (billingReason === "subscription_update") {
    const credits = (filter: (l: InvoiceLineSummary) => boolean) => {
      const seen = new Set<string>();
      let total = 0;
      for (const l of lines.filter(filter)) {
        if (!l.priceId || seen.has(l.priceId)) continue;
        const plan = planOf(l.priceId);
        if (!plan) continue;
        seen.add(l.priceId);
        total += plan.credits;
      }
      return total;
    };
    const added = credits((l) => l.amount > 0);
    const removed = credits((l) => l.amount < 0);
    const diff = added - removed;
    if (diff <= 0) return null;
    const newLine = lines.find((l) => l.amount > 0 && l.priceId && planOf(l.priceId));
    const plan = newLine?.priceId ? planOf(newLine.priceId)! : null;
    if (!plan) return null;
    return { credits: diff, plan, expiresAt: grantExpiry(plan.interval, now), note: `Upgrade to ${plan.name}` };
  }
  return null;
}

export interface SubscriptionPatch {
  stripe_subscription_id: string | null;
  plan_key: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

/** What we mirror onto `workspaces` from a subscription object. */
export function subscriptionPatch(sub: Stripe.Subscription, planKey: string | null, deleted = false): SubscriptionPatch {
  const item = sub.items.data[0];
  if (deleted || sub.status === "canceled") {
    return { stripe_subscription_id: null, plan_key: null, subscription_status: "canceled", cancel_at_period_end: false, current_period_end: null };
  }
  // Newer API versions schedule a period-end cancel via `cancel_at` (the
  // portal does this) and leave `cancel_at_period_end` false — honour both.
  const periodEnd = item?.current_period_end ?? null;
  const cancelAt = sub.cancel_at ?? null;
  const scheduled = sub.cancel_at_period_end || cancelAt !== null;
  const end = cancelAt !== null && (periodEnd === null || cancelAt < periodEnd) ? cancelAt : periodEnd;
  return {
    stripe_subscription_id: sub.id,
    plan_key: planKey,
    subscription_status: sub.status,
    cancel_at_period_end: scheduled,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
  };
}

/* ----------------------------------------------------- change detection */

export type SubscriptionChangeKind = "plan_started" | "plan_changed" | "plan_cancel_scheduled" | "plan_cancel_reverted" | "plan_canceled";

export interface SubscriptionBefore {
  plan_key: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean;
}

/** Statuses under which a plan counts as running (billing hiccups included). */
const RUNNING = new Set(["active", "trialing", "past_due", "unpaid"]);
const isRunning = (status: string | null) => status !== null && RUNNING.has(status);

/**
 * Which user-facing event a subscription webhook represents, by diffing the
 * stored workspace row with the patch about to be written. `null` for status
 * churn that changes nothing for the customer (e.g. incomplete → active with
 * the same plan already announced, or a repeated event).
 */
export function subscriptionChange(before: SubscriptionBefore, patch: SubscriptionPatch): SubscriptionChangeKind | null {
  if (patch.subscription_status === "canceled") {
    return before.plan_key && before.subscription_status !== "canceled" ? "plan_canceled" : null;
  }
  if (!isRunning(patch.subscription_status) || !patch.plan_key) return null;
  if (!before.plan_key || !isRunning(before.subscription_status)) return "plan_started";
  if (before.plan_key !== patch.plan_key) return "plan_changed";
  if (!before.cancel_at_period_end && patch.cancel_at_period_end) return "plan_cancel_scheduled";
  if (before.cancel_at_period_end && !patch.cancel_at_period_end) return "plan_cancel_reverted";
  return null;
}
