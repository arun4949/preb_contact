/**
 * Creates or updates the Preb customer-portal configuration (idempotent:
 * found by `metadata.preb_managed`). Lets customers update payment method,
 * address and tax id, see invoices and cancel at period end. Plan switching
 * happens in the app (Settings › Billing › Change plan): the portal can list
 * at most 10 products and the catalogue has 22.
 *
 *   npm run stripe:portal            (uses STRIPE_SECRET_KEY from .env.local)
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}
const stripe = new Stripe(key);
/* The marketing website (Framer) hosts the legal pages; the app runs on app.preb.co. */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://preb.co";

async function main() {
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: {
      headline: "Manage your Preb subscription, payment method and invoices.",
      privacy_policy_url: `${SITE}/privacy`,
      terms_of_service_url: `${SITE}/terms`,
    },
    features: {
      customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "tax_id"] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "switched_service", "other"] },
      },
      subscription_update: { enabled: false },
    },
    default_return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.preb.co"}/lists?settings=billing`,
    metadata: { preb_managed: "true" },
  };

  const existing = (await stripe.billingPortal.configurations.list({ limit: 20 })).data.find((c) => c.metadata?.preb_managed === "true");
  const config = existing
    ? await stripe.billingPortal.configurations.update(existing.id, { ...params, active: true })
    : await stripe.billingPortal.configurations.create(params);
  console.log(`${existing ? "Updated" : "Created"} portal configuration ${config.id} (cancel at period end; plan switching in-app).`);
  console.log(`Optional: STRIPE_PORTAL_CONFIG_ID=${config.id} (the app also finds it by metadata).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
