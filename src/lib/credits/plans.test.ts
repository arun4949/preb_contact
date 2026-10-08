import { describe, expect, it } from "vitest";
import { MIN_MARGIN, PLANS } from "./plans";
import { CREDIT_MULTIPLIER } from "@/lib/fullenrich/mapping";

describe("plan catalogue (pricing v2)", () => {
  it("has 11 monthly and 11 annual tiers with unique keys", () => {
    expect(PLANS.filter((p) => p.interval === "month")).toHaveLength(11);
    expect(PLANS.filter((p) => p.interval === "year")).toHaveLength(11);
    expect(new Set(PLANS.map((p) => p.key)).size).toBe(PLANS.length);
  });

  it("sells CREDIT_MULTIPLIER × the upstream credits", () => {
    for (const p of PLANS) expect(p.credits).toBe(p.upstreamCredits * CREDIT_MULTIPLIER);
  });

  it("keeps at least the 20 % margin on every tier, rounded up to $0.50", () => {
    for (const p of PLANS) {
      expect(p.priceCents).toBeGreaterThanOrEqual(p.upstreamCents * MIN_MARGIN);
      expect(p.priceCents % 50).toBe(0);
      // Rounding never adds more than one 0.50 step.
      expect(p.priceCents - p.upstreamCents * MIN_MARGIN).toBeLessThan(50);
    }
  });

  it("annual tiers line up with monthly tiers by position and cost ~10 % less", () => {
    const monthly = PLANS.filter((p) => p.interval === "month");
    const annual = PLANS.filter((p) => p.interval === "year");
    monthly.forEach((mp, i) => {
      const ap = annual[i];
      expect(ap.credits).toBe(mp.credits * 12);
      expect(ap.priceCents).toBeLessThan(mp.priceCents * 12);
      expect(ap.priceCents).toBeGreaterThan(mp.priceCents * 12 * 0.85);
    });
  });

  it("spot-checks management's table", () => {
    expect(PLANS.find((p) => p.key === "p2_1k_m")).toMatchObject({ credits: 1000, priceCents: 3650 });
    expect(PLANS.find((p) => p.key === "p2_200k_m")).toMatchObject({ credits: 200000, priceCents: 437500 });
    expect(PLANS.find((p) => p.key === "p2_12k_y")).toMatchObject({ credits: 12000, priceCents: 39000 });
  });
});
