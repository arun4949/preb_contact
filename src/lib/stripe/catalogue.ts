import "server-only";

import type Stripe from "stripe";
import { PLANS, type Plan, type PlanInterval } from "@/lib/credits/plans";
import { stripe } from "./client";

/** A plan as sold: the catalogue entry plus the live Stripe price. */
export interface CataloguePlan extends Plan {
  priceId: string;
  productId: string;
  /** Amount charged per billing period, in USD cents (the Stripe price, not an estimate). */
  priceCents: number;
}

export const LOOKUP_PREFIX = "preb_";
export const lookupKeyFor = (planKey: string) => `${LOOKUP_PREFIX}${planKey}`;

/** `preb_pro_500_m` → `pro_500_m`; anything else → null. */
export function planKeyFromLookup(lookupKey: string | null | undefined): string | null {
  if (!lookupKey || !lookupKey.startsWith(LOOKUP_PREFIX)) return null;
  const key = lookupKey.slice(LOOKUP_PREFIX.length);
  return PLANS.some((p) => p.key === key) ? key : null;
}

const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; plans: CataloguePlan[] } | null = null;

/** Prices are fixed in Stripe; this resolves the catalogue by lookup key (cached 10 min per instance). */
export async function getCatalogue(): Promise<CataloguePlan[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.plans;
  // `lookup_keys` accepts at most 10 per request.
  const keys = PLANS.map((p) => lookupKeyFor(p.key));
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 10) chunks.push(keys.slice(i, i + 10));
  const pages = await Promise.all(chunks.map((lookup_keys) => stripe().prices.list({ lookup_keys, active: true, limit: 100 })));
  const byKey = new Map(pages.flatMap((page) => page.data).map((price) => [planKeyFromLookup(price.lookup_key), price]));
  const plans: CataloguePlan[] = [];
  for (const plan of PLANS) {
    const price = byKey.get(plan.key);
    if (!price || price.unit_amount == null) continue;
    plans.push({
      ...plan,
      priceId: price.id,
      productId: typeof price.product === "string" ? price.product : price.product.id,
      priceCents: price.unit_amount,
    });
  }
  cached = { at: Date.now(), plans };
  return plans;
}

export async function getCataloguePlan(planKey: string): Promise<CataloguePlan | null> {
  return (await getCatalogue()).find((p) => p.key === planKey) ?? null;
}

/** Resolve a Stripe price id to our plan (catalogue first, then one API read). */
export async function planForPriceId(priceId: string): Promise<CataloguePlan | null> {
  const hit = (await getCatalogue()).find((p) => p.priceId === priceId);
  if (hit) return hit;
  const price = await stripe().prices.retrieve(priceId);
  const key = planKeyFromLookup(price.lookup_key);
  return key ? getCataloguePlan(key) : null;
}

export function intervalLabel(interval: PlanInterval): string {
  return interval === "year" ? "year" : "month";
}

export type { Stripe };
