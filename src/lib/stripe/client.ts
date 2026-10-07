import "server-only";

import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazy Stripe singleton (secret key from the environment; test or live). */
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { appInfo: { name: "Preb", url: "https://preb.co" } });
  }
  return client;
}

/** True when the configured key is a live-mode key — webhook events are gated on this. */
export function isLiveMode(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live") || key.startsWith("rk_live");
}

/** Invoice footer for the German small-business VAT exemption (CTO decision, day 4). */
export const INVOICE_FOOTER = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. / No VAT is charged under § 19 UStG (German small business regulation).";
