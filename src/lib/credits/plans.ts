/**
 * Plan catalogue mirrored from the upstream Pro tiers. Prices are USD per
 * month; `upstream` is what we pay, our list price = upstream × MARGIN
 * (display only — the real price lives in Stripe and is fixed there).
 */
export type PlanInterval = "month" | "year";

export interface Plan {
  key: string;
  name: string;
  interval: PlanInterval;
  /** Credits granted per billing period (monthly: per month; annual: per year, up front). */
  credits: number;
  /** Upstream price in USD per month (annual plans: per month, billed yearly). */
  upstreamMonthly: number;
}

export const PLANS: Plan[] = [
  { key: "pro_500_m", name: "Pro 500", interval: "month", credits: 500, upstreamMonthly: 29 },
  { key: "pro_750_m", name: "Pro 750", interval: "month", credits: 750, upstreamMonthly: 42.75 },
  { key: "pro_1k_m", name: "Pro 1k", interval: "month", credits: 1000, upstreamMonthly: 55 },
  { key: "pro_1500_m", name: "Pro 1.5k", interval: "month", credits: 1500, upstreamMonthly: 79.5 },
  { key: "pro_2k_m", name: "Pro 2k", interval: "month", credits: 2000, upstreamMonthly: 104 },
  { key: "pro_5k_m", name: "Pro 5k", interval: "month", credits: 5000, upstreamMonthly: 255 },
  { key: "pro_10k_m", name: "Pro 10k", interval: "month", credits: 10000, upstreamMonthly: 499 },
  { key: "pro_6k_y", name: "Pro 6k", interval: "year", credits: 6000, upstreamMonthly: 26 },
  { key: "pro_9k_y", name: "Pro 9k", interval: "year", credits: 9000, upstreamMonthly: 39 },
  { key: "pro_12k_y", name: "Pro 12k", interval: "year", credits: 12000, upstreamMonthly: 49 },
  { key: "pro_18k_y", name: "Pro 18k", interval: "year", credits: 18000, upstreamMonthly: 71 },
  { key: "pro_24k_y", name: "Pro 24k", interval: "year", credits: 24000, upstreamMonthly: 94 },
  { key: "pro_60k_y", name: "Pro 60k", interval: "year", credits: 60000, upstreamMonthly: 232 },
  { key: "pro_120k_y", name: "Pro 120k", interval: "year", credits: 120000, upstreamMonthly: 454 },
];

export const MARGIN_MULTIPLIER = Number(process.env.MARGIN_MULTIPLIER ?? "1.15");

/** Our list price in USD cents for one billing period. */
export function planPriceCents(plan: Plan, margin = MARGIN_MULTIPLIER): number {
  const monthly = plan.upstreamMonthly * margin;
  const perPeriod = plan.interval === "year" ? monthly * 12 : monthly;
  // Round to whole dollars; charm pricing is a day-5 decision.
  return Math.round(perPeriod) * 100;
}

export function getPlan(key: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.key === key);
}

/** Grant expiry: monthly grants +3 months, annual +12 months, trial +30 days. */
export function grantExpiry(interval: PlanInterval, from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + (interval === "year" ? 12 : 3));
  return d;
}
