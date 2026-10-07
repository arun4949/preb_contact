import "server-only";

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import { INVOICE_FOOTER, stripe } from "./client";
import type { CataloguePlan } from "./catalogue";

type Workspace = Tables<"workspaces">;

/**
 * Customer is created lazily before the first Checkout and remembered on the
 * workspace (`metadata.workspace_id` lets the webhook resolve it the other way).
 */
export async function ensureCustomer(workspace: Workspace, email: string): Promise<string> {
  if (workspace.stripe_customer_id) {
    try {
      const existing = await stripe().customers.retrieve(workspace.stripe_customer_id);
      if (!existing.deleted) return existing.id;
    } catch {
      // fall through and create a fresh customer (deleted or wrong mode)
    }
  }
  const customer = await stripe().customers.create({
    name: workspace.name,
    email,
    metadata: { workspace_id: workspace.id, app: "preb" },
    invoice_settings: { footer: INVOICE_FOOTER },
  });
  const admin = createAdminClient();
  await admin.from("workspaces").update({ stripe_customer_id: customer.id }).eq("id", workspace.id);
  return customer.id;
}

export interface CheckoutUrls {
  successUrl: string;
  cancelUrl: string;
}

/** Subscription Checkout: billing address + tax id collected for invoices, no automatic tax (§ 19 UStG). */
export async function createCheckoutSession(
  workspace: Workspace,
  customerId: string,
  plan: CataloguePlan,
  urls: CheckoutUrls,
): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: workspace.id,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    billing_address_collection: "required",
    customer_update: { address: "auto", name: "auto" },
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { workspace_id: workspace.id, plan_key: plan.key, app: "preb" },
    },
    metadata: { workspace_id: workspace.id, plan_key: plan.key },
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
  });
}
