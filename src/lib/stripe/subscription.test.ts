import { describe, expect, it, vi } from "vitest";

const retrieve = vi.fn();
vi.mock("./client", () => ({ stripe: () => ({ subscriptions: { retrieve } }) }));

const { activeSubscriptionId } = await import("./subscription");

describe("activeSubscriptionId", () => {

  // Runs first, so `retrieve` has no calls yet (a beforeEach reset makes Vitest 5 report the mocked throws below as failures).
  it("returns null without calling Stripe when nothing is stored or it is canceled", async () => {
    expect(await activeSubscriptionId({ stripe_subscription_id: null, subscription_status: null })).toBeNull();
    expect(await activeSubscriptionId({ stripe_subscription_id: "sub_1", subscription_status: "canceled" })).toBeNull();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("returns the id when it exists in this mode", async () => {
    retrieve.mockResolvedValue({ id: "sub_1", status: "active" });
    expect(await activeSubscriptionId({ stripe_subscription_id: "sub_1", subscription_status: "active" })).toBe("sub_1");
  });

  it("treats an id from the other Stripe mode (resource_missing) as no subscription", async () => {
    retrieve.mockImplementation(async () => {
      throw Object.assign(new Error("No such subscription"), { code: "resource_missing" });
    });
    expect(await activeSubscriptionId({ stripe_subscription_id: "sub_test", subscription_status: "active" })).toBeNull();
  });

  it("treats a subscription canceled in Stripe as none", async () => {
    retrieve.mockResolvedValue({ id: "sub_1", status: "canceled" });
    expect(await activeSubscriptionId({ stripe_subscription_id: "sub_1", subscription_status: "active" })).toBeNull();
  });

  it("propagates other Stripe errors", async () => {
    retrieve.mockImplementation(async () => {
      throw new Error("network");
    });
    await expect(activeSubscriptionId({ stripe_subscription_id: "sub_1", subscription_status: "active" })).rejects.toThrow("network");
  });
});
