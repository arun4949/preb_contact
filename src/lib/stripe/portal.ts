import "server-only";

import type Stripe from "stripe";
import { stripe } from "./client";

/** Metadata marker on the Preb portal configuration (created by `scripts/stripe-portal.ts`). */
export const PORTAL_MARKER = { preb_managed: "true" } as const;

let cachedConfigId: string | null | undefined;

/**
 * The Preb-specific portal configuration: env override, else the active
 * configuration tagged `preb_managed`, else Stripe's account default.
 */
export async function portalConfigurationId(): Promise<string | undefined> {
  const fromEnv = process.env.STRIPE_PORTAL_CONFIG_ID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedConfigId !== undefined) return cachedConfigId ?? undefined;
  const { data } = await stripe().billingPortal.configurations.list({ active: true, limit: 20 });
  cachedConfigId = data.find((c) => c.metadata?.preb_managed === "true")?.id ?? null;
  return cachedConfigId ?? undefined;
}

export async function createPortalSession(customerId: string, returnUrl: string, flowData?: Stripe.BillingPortal.SessionCreateParams.FlowData) {
  return stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    configuration: await portalConfigurationId(),
    flow_data: flowData,
  });
}
