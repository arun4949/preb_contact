/**
 * Creates (or updates) the Preb plan catalogue in Stripe. Idempotent: products
 * are looked up by `metadata.plan_key`; a new price is only created when the
 * amount, currency or interval changed, and the old one is deactivated.
 * Preb products whose plan_key is no longer in PLANS are archived (their
 * prices deactivated first). Nothing without `metadata.app = preb` is touched —
 * the old Pre app shares this Stripe account.
 *
 *   npm run stripe:catalogue            (uses STRIPE_SECRET_KEY from .env.local)
 *
 * Prices are EUR and fixed in `src/lib/credits/plans.ts` (pricing v2).
 */
import Stripe from "stripe";
import { PLANS } from "../src/lib/credits/plans";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is required");
  process.exit(1);
}
const stripe = new Stripe(key);
const TAX_CODE = "txcd_10103001"; // Software as a service (B2B)
const CURRENCY = "eur";
const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

async function main() {
  const mode = key!.startsWith("sk_live") || key!.startsWith("rk_live") ? "LIVE" : "test";
  console.log(`Syncing ${PLANS.length} plans in ${mode} mode (${CURRENCY.toUpperCase()})`);

  // `products.list` is strongly consistent (search lags behind writes and once
  // produced duplicates). When a plan_key has several products — e.g. after an
  // interrupted run — the one whose active price carries the lookup key wins.
  const all = await stripe.products.list({ active: true, limit: 100 }).autoPagingToArray({ limit: 1000 });
  const existing = all.filter((p) => p.metadata.app === "preb");
  const byKey = new Map<string, Stripe.Product>();
  const duplicates: Stripe.Product[] = [];
  for (const p of existing) {
    const key = p.metadata.plan_key;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, p);
      continue;
    }
    const prices = await stripe.prices.list({ product: p.id, active: true, limit: 10 });
    if (prices.data.some((pr) => pr.lookup_key === `preb_${key}`)) {
      duplicates.push(prev);
      byKey.set(key, p);
    } else duplicates.push(p);
  }

  for (const plan of PLANS) {
    const amount = plan.priceCents;
    const name = `${plan.name} (${plan.interval === "year" ? "annual" : "monthly"})`;
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
      (p) => p.unit_amount === amount && p.currency === CURRENCY && p.recurring?.interval === plan.interval,
    );
    if (current) {
      if (product.default_price !== current.id) await stripe.products.update(product.id, { default_price: current.id });
      console.log(`  = price ${current.id} ${eur(amount)}/${plan.interval}`);
      continue;
    }

    const price = await stripe.prices.create({
      product: product.id,
      currency: CURRENCY,
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
    console.log(`  + price ${price.id} ${eur(amount)}/${plan.interval}`);
  }

  // Retire Preb products that are no longer in the catalogue (e.g. the v1 USD
  // tiers) and duplicates. A default price cannot be deactivated, so unset it first.
  const keep = new Set(PLANS.map((p) => p.key));
  const retire = [...duplicates, ...existing.filter((p) => !keep.has(p.metadata.plan_key) && !duplicates.includes(p))];
  for (const product of retire) {
    const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
    if (product.default_price) await stripe.products.update(product.id, { default_price: "" });
    for (const old of prices.data) {
      await stripe.prices.update(old.id, { active: false });
      console.log(`  - deactivated ${old.id} (${product.metadata.plan_key})`);
    }
    await stripe.products.update(product.id, { active: false });
    console.log(`- archived product ${product.id} ${product.name}`);
  }
  console.log("Done. Price lookup keys: preb_<plan_key> (e.g. preb_p2_1k_m).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
