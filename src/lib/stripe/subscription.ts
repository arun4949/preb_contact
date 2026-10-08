import "server-only";

import type Stripe from "stripe";
import { stripe } from "./client";
import type { CataloguePlan } from "./catalogue";

/**
 * In-app plan switching (the customer portal can list at most 10 products,
 * the catalogue has 14). Preview and update share one `proration_date`, so
 * the amount the user confirms is exactly what is invoiced. Upgrades and
 * downgrades are invoiced immediately (`always_invoice`); the upgrade's
 * credit difference arrives through `invoice.paid` (billing_reason
 * `subscription_update`), downgrades leave a Stripe customer balance.
 */

/**
 * The workspace's subscription id when it exists in the current Stripe mode
 * and is not canceled, else null. Dev (test key) and production (live key)
 * share one database, so a stored id can belong to the other mode: it is
 * treated as "no subscription" for this request and never cleared, because
 * the other environment still owns it. Other Stripe errors propagate.
 */
export async function activeSubscriptionId(ws: { stripe_subscription_id: string | null; subscription_status: string | null }): Promise<string | null> {
  const id = ws.stripe_subscription_id;
  if (!id || ws.subscription_status === "canceled") return null;
  try {
    const sub = await stripe().subscriptions.retrieve(id);
    return sub.status === "canceled" ? null : sub.id;
  } catch (error) {
    if ((error as { code?: string }).code === "resource_missing") return null;
    throw error;
  }
}

export interface SwitchPreview {
  /** What the saved payment method is charged now, EUR cents (0 when the change is credited). */
  amountDueCents: number;
  /** Unused time credited to the customer's balance, EUR cents (downgrades). */
  creditedCents: number;
  prorationDate: number;
}

async function primaryItem(subscriptionId: string): Promise<{ sub: Stripe.Subscription; item: Stripe.SubscriptionItem }> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const item = sub.items.data[0];
  if (!item) throw new Error("Subscription has no items");
  return { sub, item };
}

export async function previewSwitch(subscriptionId: string, plan: CataloguePlan): Promise<SwitchPreview> {
  const { sub, item } = await primaryItem(subscriptionId);
  const prorationDate = Math.floor(Date.now() / 1000);
  const invoice = await stripe().invoices.createPreview({
    customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscription: sub.id,
    subscription_details: {
      items: [{ id: item.id, price: plan.priceId, quantity: 1 }],
      proration_behavior: "always_invoice",
      proration_date: prorationDate,
    },
  });
  return {
    amountDueCents: Math.max(0, invoice.amount_due),
    creditedCents: invoice.total < 0 ? -invoice.total : 0,
    prorationDate,
  };
}

export type SwitchResult = { status: "switched" } | { status: "requires_action"; url: string | null };

export async function applySwitch(subscriptionId: string, plan: CataloguePlan, prorationDate: number): Promise<SwitchResult> {
  const { item } = await primaryItem(subscriptionId);
  const updated = await stripe().subscriptions.update(subscriptionId, {
    items: [{ id: item.id, price: plan.priceId, quantity: 1 }],
    proration_behavior: "always_invoice",
    proration_date: prorationDate,
    // A failed or 3-D Secure payment leaves the old plan in place until paid.
    payment_behavior: "pending_if_incomplete",
    expand: ["latest_invoice"],
  });
  if (updated.pending_update) {
    const invoice = updated.latest_invoice && typeof updated.latest_invoice !== "string" ? updated.latest_invoice : null;
    return { status: "requires_action", url: invoice?.hosted_invoice_url ?? null };
  }
  return { status: "switched" };
}
