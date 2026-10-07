/**
 * Registers (or re-points) the Stripe webhook endpoint for this app at
 * `${NEXT_PUBLIC_APP_URL}/api/webhooks/stripe`. Idempotent by
 * `metadata.preb_managed` + mode. Prints the signing secret on creation —
 * put it in `STRIPE_WEBHOOK_SECRET` (secrets are only shown once; pass
 * `--rotate` to delete and recreate when the secret was lost).
 *
 *   npm run stripe:webhook            # test mode with the tunnel URL
 *   npm run stripe:webhook -- --rotate
 */
import Stripe from "stripe";
import { STRIPE_EVENTS } from "../src/lib/stripe/webhooks";

const key = process.env.STRIPE_SECRET_KEY;
const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
if (!key || !origin) {
  console.error("STRIPE_SECRET_KEY and NEXT_PUBLIC_APP_URL are required");
  process.exit(1);
}
const stripe = new Stripe(key);
const rotate = process.argv.includes("--rotate");
const url = `${origin}/api/webhooks/stripe`;

async function main() {
  const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.metadata?.preb_managed === "true");
  if (existing && rotate) {
    await stripe.webhookEndpoints.del(existing.id);
    console.log(`Deleted ${existing.id}`);
  }
  if (existing && !rotate) {
    const updated = await stripe.webhookEndpoints.update(existing.id, { url, enabled_events: STRIPE_EVENTS, disabled: false });
    console.log(`Updated ${updated.id} → ${updated.url} (${updated.enabled_events.length} events). Secret unchanged.`);
    return;
  }
  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: STRIPE_EVENTS,
    description: "Preb app billing",
    metadata: { preb_managed: "true" },
  });
  console.log(`Created ${created.id} → ${created.url}`);
  console.log(`STRIPE_WEBHOOK_SECRET=${created.secret}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
