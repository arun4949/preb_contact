import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { formatUsd } from "./money";
import { getPlan, type Plan } from "./plans";

/**
 * Overspend (opt-in since 2026-10-21): a workspace with an active plan may
 * keep enriching when its balance is empty. Credits spent beyond the balance
 * are invoiced in money at the plan's per-credit rate, one invoice per list
 * when it finishes. Pure helpers only (client-safe, unit-tested); the Stripe
 * and database work lives in `@/lib/billing/overspend`.
 */

/** Stripe refuses to charge less than $0.50; smaller totals carry over to the next invoice. */
export const MIN_INVOICE_CENTS = 50;

/** Monthly limit presets as a share of the plan's credits. */
export const LIMIT_PRESET_SHARES = [0.25, 0.5, 1, 2] as const;

export type OverspendIneligibleReason = "trial" | "no_subscription" | "no_payment_method" | "internal";

export interface OverspendRate {
  planKey: string;
  planName: string;
  /** USD cents per credit, exact (e.g. 3.65 for Preb 1k). */
  centsPerCredit: number;
}

/** Per-credit rate of a plan: the fixed plan price divided by its credits. Null for no plan. */
export function overspendRate(planKey: string | null | undefined): OverspendRate | null {
  const plan = getPlan(planKey);
  if (!plan) return null;
  return { planKey: plan.key, planName: plan.name, centsPerCredit: plan.priceCents / plan.credits };
}

/** Amount for `credits` at a plan's rate, rounded to whole cents. 0 for no plan. */
export function overspendAmountCents(credits: number, planKey: string | null | undefined): number {
  const rate = overspendRate(planKey);
  if (!rate || credits <= 0) return 0;
  return Math.round(credits * rate.centsPerCredit);
}

const RATE = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

/** Per-credit price with up to four decimals (`$0.0365`), exact for every plan. */
export function formatRate(rate: OverspendRate): string {
  return RATE.format(rate.centsPerCredit / 100);
}

export interface OverspendBudgetInput {
  eligible: boolean;
  /** Monthly limit in credits, null = none. */
  limit: number | null;
  /** Credits already overspent this calendar month. */
  used: number;
}

/**
 * Credits the workspace may still overspend this month: Infinity without a
 * limit, what is left of the limit otherwise, 0 when not eligible.
 */
export function overspendBudget({ eligible, limit, used }: OverspendBudgetInput): number {
  if (!eligible) return 0;
  if (limit == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, limit - used);
}

/** Most a contact of this kind can cost, in credits (every requested field found). */
export function maxRowCost(enrichFields: readonly string[], kind: "enrich" | "reverse"): number {
  if (kind === "reverse") return CREDIT_COST.reverse;
  const cost = enrichFields.reduce((sum, f) => sum + (CREDIT_COST[f as keyof typeof CREDIT_COST] ?? 0), 0);
  return Math.max(1, cost);
}

/**
 * How many rows the next batch may hold so that balance + overspend budget
 * cover the worst case. Unlimited budget keeps the full batch; without
 * overspend the dispatcher's historical behaviour (a full batch while the
 * balance is positive) is preserved by passing `extra = 0` and `cap = false`.
 */
export function batchRowsWithinBudget(opts: { batchSize: number; spendable: number; extra: number; perRowMax: number; cap: boolean }): number {
  const { batchSize, spendable, extra, perRowMax, cap } = opts;
  if (!cap || !Number.isFinite(extra)) return batchSize;
  const rows = Math.floor((spendable + extra) / Math.max(1, perRowMax));
  return Math.max(1, Math.min(batchSize, rows));
}

export interface LimitPreset {
  credits: number | null;
  label: string;
}

/** Select options for the monthly limit: no limit plus four shares of the plan size. */
export function limitPresets(plan: Pick<Plan, "credits" | "priceCents"> | null, current: number | null): LimitPreset[] {
  const presets: LimitPreset[] = [{ credits: null, label: "No limit" }];
  const base = plan?.credits ?? 1_000;
  const values = new Set<number>(LIMIT_PRESET_SHARES.map((s) => Math.round(base * s)));
  if (current != null) values.add(current);
  for (const credits of [...values].sort((a, b) => a - b)) {
    const amount = plan ? Math.round((credits * plan.priceCents) / plan.credits) : null;
    presets.push({ credits, label: amount != null ? `${credits.toLocaleString("en-US")} credits (about ${formatUsd(amount)})` : `${credits.toLocaleString("en-US")} credits` });
  }
  return presets;
}

/** Split an invoice total across rows proportionally to their credits, rounding so the sum matches. */
export function allocateCents(rows: readonly { credits: number }[], totalCents: number): number[] {
  const total = rows.reduce((s, r) => s + r.credits, 0);
  if (total <= 0) return rows.map(() => 0);
  let left = totalCents;
  return rows.map((r, i) => {
    const share = i === rows.length - 1 ? left : Math.floor((r.credits / total) * totalCents);
    left -= share;
    return share;
  });
}
