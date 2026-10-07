/**
 * Creates (or updates) the Preb plan catalogue in Stripe. Idempotent: products
 * are looked up by `metadata.plan_key`; a new price is only created when the
 * amount or interval changed, and the old one is deactivated.
 *
 *   STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-catalogue.ts
 *
 * Run against test mode first (day 1), live mode on day 7. Prices are USD and
 * fixed in Stripe; MARGIN_MULTIPLIER only affects what this script creates.
 */
import Stripe from "stripe";
import { PLANS, MARGIN_MULTIPLIER, planPriceCents } from "../src/lib/credits/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}
const stripe = new Stripe(key);
const TAX_CODE = "txcd_10103001"; // Software as a service (B2B)

async function main() {
  const mode = key!.startsWith("sk_live") || key!.startsWith("rk_live") ? "LIVE" : "test";
  console.log(`Syncing ${PLANS.length} plans in ${mode} mode at margin ×${MARGIN_MULTIPLIER}`);

  const existing = await stripe.products.search({ query: "active:'true' AND metadata['app']:'preb'", limit: 100 });
  const byKey = new Map(existing.data.map((p) => [p.metadata.plan_key, p]));

  for (const plan of PLANS) {
    const amount = planPriceCents(plan);
    const name = `Preb ${plan.name} (${plan.interval === "year" ? "annual" : "monthly"})`;
    const description = `${plan.credits.toLocaleString("en-US")} enrichment credits per ${plan.interval}`;
    const metadata = { app: "preb", plan_key: plan.key, credits: String(plan.credits), interval: plan.interval };

    let product = byKey.get(plan.key);
    if (!product) {
      product = await stripe.products.create({ name, description, metadata, tax_code: TAX_CODE });
      console.log(`+ product ${product.id} ${name}`);
    } else if (product.name !== name || product.description !== description) {
      product = await stripe.products.update(product.id, { name, description, metadata, tax_code: TAX_CODE });
      console.log(`~ product ${product.id} ${name}`);
    }

    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    const current = prices.data.find(
      (p) => p.unit_amount === amount && p.currency === "usd" && p.recurring?.interval === plan.interval,
    );
    if (current) {
      if (product.default_price !== current.id) await stripe.products.update(product.id, { default_price: current.id });
      console.log(`  = price ${current.id} $${(amount / 100).toFixed(2)}/${plan.interval}`);
      continue;
    }

    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: amount,
      recurring: { interval: plan.interval },
      tax_behavior: "exclusive",
      metadata,
      lookup_key: `preb_${plan.key}`,
      transfer_lookup_key: true,
    });
    await stripe.products.update(product.id, { default_price: price.id });
    for (const old of prices.data) {
      await stripe.prices.update(old.id, { active: false });
      console.log(`  - deactivated ${old.id}`);
    }
    console.log(`  + price ${price.id} $${(amount / 100).toFixed(2)}/${plan.interval}`);
  }
  console.log("Done. Price lookup keys: preb_<plan_key> (e.g. preb_pro_500_m).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
