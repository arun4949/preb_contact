import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { PLANS } from "@/lib/credits/plans";
import { decideGrant, subscriptionChange, subscriptionPatch, type InvoiceLineSummary, type SubscriptionBefore, type SubscriptionPatch } from "./webhooks";
import { planKeyFromLookup as fromCatalogue } from "./catalogue";

const p1k = PLANS.find((p) => p.key === "p2_1k_m")!;
const p2k = PLANS.find((p) => p.key === "p2_2k_m")!;
const p12k = PLANS.find((p) => p.key === "p2_12k_y")!;
const planOf = (id: string) => ({ price_1k: p1k, price_2k: p2k, price_12k: p12k })[id] ?? null;
const now = new Date("2026-10-07T10:00:00Z");

describe("decideGrant", () => {
  it("grants the full plan on subscription_create, expiring +3 months", () => {
    const g = decideGrant("subscription_create", [{ priceId: "price_1k", amount: 3650 }], planOf, now);
    expect(g?.credits).toBe(1000);
    expect(g?.expiresAt.toISOString().slice(0, 10)).toBe("2027-01-07");
    expect(g?.note).toBe("Preb 1k · monthly");
  });
  it("clamps expiry to the end of the target month instead of overflowing", () => {
    const nov30 = new Date("2026-11-30T10:00:00Z");
    const g = decideGrant("subscription_cycle", [{ priceId: "price_1k", amount: 3650 }], planOf, nov30);
    expect(g?.expiresAt.toISOString().slice(0, 10)).toBe("2027-02-28");
  });
  it("annual renewals expire +12 months", () => {
    const g = decideGrant("subscription_cycle", [{ priceId: "price_12k", amount: 39000 }], planOf, now);
    expect(g?.credits).toBe(12000);
    expect(g?.expiresAt.toISOString().slice(0, 10)).toBe("2027-10-07");
    expect(g?.note).toContain("renewal");
  });
  it("upgrade grants the difference from the proration lines", () => {
    const lines: InvoiceLineSummary[] = [
      { priceId: "price_1k", amount: -2000 },
      { priceId: "price_2k", amount: 4000 },
    ];
    const g = decideGrant("subscription_update", lines, planOf, now);
    expect(g?.credits).toBe(1000);
    expect(g?.plan.key).toBe("p2_2k_m");
  });
  it("downgrade grants nothing", () => {
    const lines: InvoiceLineSummary[] = [
      { priceId: "price_2k", amount: -4000 },
      { priceId: "price_1k", amount: 2000 },
    ];
    expect(decideGrant("subscription_update", lines, planOf, now)).toBeNull();
  });
  it("ignores unknown prices and other billing reasons", () => {
    expect(decideGrant("manual", [{ priceId: "price_1k", amount: 100 }], planOf, now)).toBeNull();
    expect(decideGrant("subscription_create", [{ priceId: "price_x", amount: 100 }], planOf, now)).toBeNull();
  });
});

describe("lookup keys", () => {
  it("maps preb_<plan_key> and rejects others", () => {
    expect(fromCatalogue("preb_p2_1k_m")).toBe("p2_1k_m");
    // v1 USD prices (retired 2026-10-08) must never resolve to a v2 plan.
    expect(fromCatalogue("preb_pro_500_m")).toBeNull();
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
    const p = subscriptionPatch(sub, "p2_1k_m");
    expect(p).toEqual({
      stripe_subscription_id: "sub_1",
      plan_key: "p2_1k_m",
      subscription_status: "active",
      cancel_at_period_end: true,
      current_period_end: new Date(1_800_000_000 * 1000).toISOString(),
    });
  });
  it("treats a portal cancel (cancel_at set, flag false) as scheduled", () => {
    const viaCancelAt = { ...sub, cancel_at_period_end: false, cancel_at: 1_800_000_000 } as unknown as Stripe.Subscription;
    expect(subscriptionPatch(viaCancelAt, "p2_1k_m").cancel_at_period_end).toBe(true);
    const renewed = { ...sub, cancel_at_period_end: false, cancel_at: null } as unknown as Stripe.Subscription;
    expect(subscriptionPatch(renewed, "p2_1k_m").cancel_at_period_end).toBe(false);
  });
  it("clears the plan when deleted or canceled", () => {
    expect(subscriptionPatch(sub, "p2_1k_m", true).plan_key).toBeNull();
    expect(subscriptionPatch({ ...sub, status: "canceled" } as Stripe.Subscription, "p2_1k_m").stripe_subscription_id).toBeNull();
  });
});

describe("subscriptionChange", () => {
  const patch = (over: Partial<SubscriptionPatch>): SubscriptionPatch => ({
    stripe_subscription_id: "sub_1",
    plan_key: "p2_1k_m",
    subscription_status: "active",
    cancel_at_period_end: false,
    current_period_end: null,
    ...over,
  });
  const none: SubscriptionBefore = { plan_key: null, subscription_status: null, cancel_at_period_end: false };
  const running: SubscriptionBefore = { plan_key: "p2_1k_m", subscription_status: "active", cancel_at_period_end: false };

  it("starts when no plan was stored", () => {
    expect(subscriptionChange(none, patch({}))).toBe("plan_started");
  });
  it("starts when the stored plan was incomplete and becomes active", () => {
    expect(subscriptionChange({ ...running, subscription_status: "incomplete" }, patch({}))).toBe("plan_started");
  });
  it("stays quiet while incomplete", () => {
    expect(subscriptionChange(none, patch({ subscription_status: "incomplete" }))).toBeNull();
  });
  it("changes when the plan key differs", () => {
    expect(subscriptionChange(running, patch({ plan_key: "p2_2k_m" }))).toBe("plan_changed");
  });
  it("detects a scheduled cancel and its reversal", () => {
    expect(subscriptionChange(running, patch({ cancel_at_period_end: true }))).toBe("plan_cancel_scheduled");
    expect(subscriptionChange({ ...running, cancel_at_period_end: true }, patch({}))).toBe("plan_cancel_reverted");
  });
  it("cancels once", () => {
    const canceled = patch({ stripe_subscription_id: null, plan_key: null, subscription_status: "canceled" });
    expect(subscriptionChange(running, canceled)).toBe("plan_canceled");
    expect(subscriptionChange({ plan_key: null, subscription_status: "canceled", cancel_at_period_end: false }, canceled)).toBeNull();
  });
  it("ignores repeated events and past_due churn", () => {
    expect(subscriptionChange(running, patch({}))).toBeNull();
    expect(subscriptionChange({ ...running, subscription_status: "past_due" }, patch({}))).toBeNull();
  });
});
