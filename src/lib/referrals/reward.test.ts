import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/email/resend", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/notifications/emit", () => ({ notifyWorkspace: vi.fn() }));

const { rewardExpiry, shouldAttemptReward } = await import("./reward");

const subscriptionInvoice = (amountPaid: number, metadata: Record<string, string> = {}) =>
  ({ metadata, amount_paid: amountPaid, parent: { subscription_details: { subscription: "sub_1", metadata: {} } } }) as never;

describe("shouldAttemptReward", () => {
  it("accepts a paid subscription invoice", () => {
    expect(shouldAttemptReward(subscriptionInvoice(3650))).toBe(true);
  });
  it("ignores a 100 % promotion code (nothing paid)", () => {
    expect(shouldAttemptReward(subscriptionInvoice(0))).toBe(false);
  });
  it("ignores overspend invoices", () => {
    expect(shouldAttemptReward(subscriptionInvoice(500, { preb_kind: "overage" }))).toBe(false);
  });
  it("ignores one-off invoices without a subscription", () => {
    expect(shouldAttemptReward({ metadata: {}, amount_paid: 500, parent: null } as never)).toBe(false);
  });
});

describe("rewardExpiry", () => {
  it("is twelve months after the grant", () => {
    expect(rewardExpiry(new Date("2026-11-05T10:00:00Z")).toISOString()).toBe("2027-11-05T10:00:00.000Z");
  });
});
