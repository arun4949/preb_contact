/**
 * Plan catalogue (pricing v2, 2026-10-08). Prices are USD per billing period
 * and FIXED here and in Stripe — the app reads the live amount from Stripe by
 * lookup key, this table only names the plans and their credits.
 *
 * Unit: 1 Preb credit = ½ upstream credit (see CREDIT_MULTIPLIER in
 * `@/lib/fullenrich/mapping`). Every tier is 2× the upstream credit count at
 * 1.25× the upstream price rounded up to the next $0.50 (≥ 20 % margin);
 * annual = upstream yearly total × 1.25. `upstreamCredits` / `upstreamCents`
 * document that basis and are never shown to customers.
 */
export type PlanInterval = "month" | "year";

export interface Plan {
  key: string;
  name: string;
  interval: PlanInterval;
  /** Credits granted per billing period (monthly: per month; annual: per year, up front). */
  credits: number;
  /** Our list price in USD cents per billing period (the amount fixed in Stripe). */
  priceCents: number;
  /** Upstream credits bought for the same period (documentation only). */
  upstreamCredits: number;
  /** Upstream price per billing period in cents (documentation only). */
  upstreamCents: number;
}

const m = (size: string, credits: number, priceCents: number, upstreamCents: number): Plan => ({
  key: `p2_${size}_m`,
  name: `Preb ${size.replace("1500", "1.5k")}`,
  interval: "month",
  credits,
  priceCents,
  upstreamCredits: credits / 2,
  upstreamCents,
});
const y = (size: string, credits: number, priceCents: number, upstreamCents: number): Plan => ({
  key: `p2_${size}_y`,
  name: `Preb ${size.replace("1200k", "1.2M").replace("2400k", "2.4M")}`,
  interval: "year",
  credits,
  priceCents,
  upstreamCredits: credits / 2,
  upstreamCents,
});

export const PLANS: Plan[] = [
  // Monthly — upstream 500 … 100k credits at 29 … 3,500 per month.
  m("1k", 1_000, 36_50, 29_00),
  m("1500", 1_500, 53_50, 42_75),
  m("2k", 2_000, 69_00, 55_00),
  m("3k", 3_000, 99_50, 79_50),
  m("4k", 4_000, 130_00, 104_00),
  m("10k", 10_000, 319_00, 255_00),
  m("20k", 20_000, 624_00, 499_00),
  m("30k", 30_000, 900_00, 720_00),
  m("50k", 50_000, 1_437_50, 1_150_00),
  m("100k", 100_000, 2_437_50, 1_950_00),
  m("200k", 200_000, 4_375_00, 3_500_00),
  // Annual — upstream 6k … 1.2M credits per year at 26 … 3,150 per month billed yearly.
  y("12k", 12_000, 390_00, 312_00),
  y("18k", 18_000, 585_00, 468_00),
  y("24k", 24_000, 735_00, 588_00),
  y("36k", 36_000, 1_065_00, 852_00),
  y("48k", 48_000, 1_410_00, 1_128_00),
  y("120k", 120_000, 3_480_00, 2_784_00),
  y("240k", 240_000, 6_810_00, 5_448_00),
  y("360k", 360_000, 9_825_00, 7_860_00),
  y("600k", 600_000, 15_690_00, 12_552_00),
  y("1200k", 1_200_000, 26_535_00, 21_228_00),
  y("2400k", 2_400_000, 47_250_00, 37_800_00),
];

/** Minimum margin over upstream that every plan must keep (asserted in tests). */
export const MIN_MARGIN = 1.25;

export function getPlan(key: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.key === key);
}

/** Grant expiry: monthly grants +3 months, annual +12 months, trial +30 days. */
export function grantExpiry(interval: PlanInterval, from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + (interval === "year" ? 12 : 3));
  return d;
}
