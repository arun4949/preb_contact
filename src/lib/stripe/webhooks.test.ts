import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { PLANS } from "@/lib/credits/plans";
import { decideGrant, subscriptionPatch, type InvoiceLineSummary } from "./webhooks";
import { planKeyFromLookup as fromCatalogue } from "./catalogue";

const pro500 = PLANS.find((p) => p.key === "pro_500_m")!;
const pro1k = PLANS.find((p) => p.key === "pro_1k_m")!;
const pro6k = PLANS.find((p) => p.key === "pro_6k_y")!;
const planOf = (id: string) => ({ price_500: pro500, price_1k: pro1k, price_6k: pro6k })[id] ?? null;
const now = new Date("2026-10-07T10:00:00Z");

describe("decideGrant", () => {
  it("grants the full plan on subscription_create, expiring +3 months", () => {
    const g = decideGrant("subscription_create", [{ priceId: "price_500", amount: 3300 }], planOf, now);
    expect(g?.credits).toBe(500);
    expect(g?.expiresAt.toISOString().slice(0, 10)).toBe("2027-01-07");
    expect(g?.note).toBe("Pro 500 · monthly");
  });
  it("annual renewals expire +12 months", () => {
    const g = decideGrant("subscription_cycle", [{ priceId: "price_6k", amount: 35900 }], planOf, now);
    expect(g?.credits).toBe(6000);
    expect(g?.expiresAt.toISOString().slice(0, 10)).toBe("2027-10-07");
    expect(g?.note).toContain("renewal");
  });
  it("upgrade grants the difference from the proration lines", () => {
    const lines: InvoiceLineSummary[] = [
      { priceId: "price_500", amount: -2000 },
      { priceId: "price_1k", amount: 4000 },
    ];
    const g = decideGrant("subscription_update", lines, planOf, now);
    expect(g?.credits).toBe(500);
    expect(g?.plan.key).toBe("pro_1k_m");
  });
  it("downgrade grants nothing", () => {
    const lines: InvoiceLineSummary[] = [
      { priceId: "price_1k", amount: -4000 },
      { priceId: "price_500", amount: 2000 },
    ];
    expect(decideGrant("subscription_update", lines, planOf, now)).toBeNull();
  });
  it("ignores unknown prices and other billing reasons", () => {
    expect(decideGrant("manual", [{ priceId: "price_500", amount: 100 }], planOf, now)).toBeNull();
    expect(decideGrant("subscription_create", [{ priceId: "price_x", amount: 100 }], planOf, now)).toBeNull();
  });
});

describe("lookup keys", () => {
  it("maps preb_<plan_key> and rejects others", () => {
    expect(fromCatalogue("preb_pro_500_m")).toBe("pro_500_m");
    expect(fromCatalogue("preb_nope")).toBeNull();
    expect(fromCatalogue(null)).toBeNull();
  });
});

describe("subscriptionPatch", () => {
  const sub = {
    id: "sub_1",
    status: "active",
    cancel_at_period_end: true,
    items: { data: [{ current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
  it("mirrors status, cancel flag and the item period end", () => {
    const p = subscriptionPatch(sub, "pro_500_m");
    expect(p).toEqual({
      stripe_subscription_id: "sub_1",
      plan_key: "pro_500_m",
      subscription_status: "active",
      cancel_at_period_end: true,
      current_period_end: new Date(1_800_000_000 * 1000).toISOString(),
    });
  });
  it("treats a portal cancel (cancel_at set, flag false) as scheduled", () => {
    const viaCancelAt = { ...sub, cancel_at_period_end: false, cancel_at: 1_800_000_000 } as unknown as Stripe.Subscription;
    expect(subscriptionPatch(viaCancelAt, "pro_500_m").cancel_at_period_end).toBe(true);
    const renewed = { ...sub, cancel_at_period_end: false, cancel_at: null } as unknown as Stripe.Subscription;
    expect(subscriptionPatch(renewed, "pro_500_m").cancel_at_period_end).toBe(false);
  });
  it("clears the plan when deleted or canceled", () => {
    expect(subscriptionPatch(sub, "pro_500_m", true).plan_key).toBeNull();
    expect(subscriptionPatch({ ...sub, status: "canceled" } as Stripe.Subscription, "pro_500_m").stripe_subscription_id).toBeNull();
  });
});
