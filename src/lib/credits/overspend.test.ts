import { describe, expect, it } from "vitest";
import { allocateCents, batchRowsWithinBudget, formatRate, limitPresets, maxRowCost, overspendAmountCents, overspendBudget, overspendRate } from "./overspend";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { getPlan } from "./plans";

describe("overspend pricing", () => {
  it("prices a credit at the plan's fixed rate", () => {
    const rate = overspendRate("p2_1k_m");
    expect(rate?.centsPerCredit).toBeCloseTo(3.65, 5);
    expect(overspendAmountCents(1_000, "p2_1k_m")).toBe(36_50);
    expect(overspendAmountCents(180, "p2_1k_m")).toBe(657);
    expect(overspendAmountCents(1, "p2_1k_m")).toBe(4);
    expect(formatRate(rate!)).toBe("$0.0365");
    expect(formatRate(overspendRate("p2_200k_m")!)).toBe("$0.0219");
  });

  it("is zero without a plan or credits", () => {
    expect(overspendRate(null)).toBeNull();
    expect(overspendAmountCents(500, null)).toBe(0);
    expect(overspendAmountCents(0, "p2_1k_m")).toBe(0);
  });
});

describe("overspend budget", () => {
  it("is unlimited without a limit, bounded with one, zero when ineligible", () => {
    expect(overspendBudget({ eligible: true, limit: null, used: 999 })).toBe(Number.POSITIVE_INFINITY);
    expect(overspendBudget({ eligible: true, limit: 1_000, used: 300 })).toBe(700);
    expect(overspendBudget({ eligible: true, limit: 1_000, used: 1_200 })).toBe(0);
    expect(overspendBudget({ eligible: false, limit: null, used: 0 })).toBe(0);
  });

  it("knows the worst-case cost per row", () => {
    expect(maxRowCost(["work_email", "mobile_phone"], "enrich")).toBe(CREDIT_COST.work_email + CREDIT_COST.mobile_phone);
    expect(maxRowCost([], "reverse")).toBe(CREDIT_COST.reverse);
    expect(maxRowCost([], "enrich")).toBe(1);
  });

  it("shrinks a batch to what balance plus budget can cover", () => {
    expect(batchRowsWithinBudget({ batchSize: 100, spendable: 0, extra: 500, perRowMax: 22, cap: true })).toBe(22);
    expect(batchRowsWithinBudget({ batchSize: 100, spendable: 50, extra: 0, perRowMax: 22, cap: true })).toBe(2);
    expect(batchRowsWithinBudget({ batchSize: 100, spendable: 1, extra: 0, perRowMax: 22, cap: true })).toBe(1);
    expect(batchRowsWithinBudget({ batchSize: 100, spendable: 0, extra: Number.POSITIVE_INFINITY, perRowMax: 22, cap: true })).toBe(100);
    expect(batchRowsWithinBudget({ batchSize: 100, spendable: 1, extra: 0, perRowMax: 22, cap: false })).toBe(100);
  });
});

describe("limit presets", () => {
  it("offers no limit plus shares of the plan with dollar amounts", () => {
    const presets = limitPresets(getPlan("p2_1k_m")!, null);
    expect(presets[0]).toEqual({ credits: null, label: "No limit" });
    expect(presets.map((p) => p.credits)).toEqual([null, 250, 500, 1_000, 2_000]);
    expect(presets[3].label).toBe("1,000 credits (about $36.50)");
  });

  it("keeps a custom current value selectable", () => {
    expect(limitPresets(getPlan("p2_1k_m")!, 750).map((p) => p.credits)).toContain(750);
  });
});

describe("allocateCents", () => {
  it("splits proportionally and sums exactly", () => {
    const parts = allocateCents([{ credits: 100 }, { credits: 50 }, { credits: 1 }], 551);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(551);
    expect(parts[0]).toBe(364);
  });
});
