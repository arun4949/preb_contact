import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { buildGaPayload, gaContextFromMetadata, gaTrackingMetadata } = await import("./measurement");

describe("GA Measurement Protocol helpers", () => {
  it("round-trips the browser context through Stripe metadata", () => {
    const ctx = { clientId: "123.456", sessionId: "1763550000" };
    expect(gaContextFromMetadata(gaTrackingMetadata(ctx))).toEqual(ctx);
    expect(gaTrackingMetadata(null)).toEqual({});
  });

  it("rejects missing or malformed metadata", () => {
    expect(gaContextFromMetadata({})).toBeNull();
    expect(gaContextFromMetadata({ ga_client_id: "abc" })).toBeNull();
    expect(gaContextFromMetadata({ ga_client_id: "1.2", ga_session_id: "x" })).toEqual({ clientId: "1.2", sessionId: null });
  });

  it("builds a purchase tied to the session", () => {
    const payload = buildGaPayload({ clientId: "1.2", sessionId: "99" }, "purchase", { transactionId: "in_1", value: 49, currency: "usd", planKey: "preb_1k" });
    expect(payload.client_id).toBe("1.2");
    expect(payload.events[0].name).toBe("purchase");
    expect(payload.events[0].params).toMatchObject({ transaction_id: "in_1", value: 49, currency: "USD", session_id: "99" });
  });

  it("builds a begin_checkout without transaction id or session", () => {
    const payload = buildGaPayload({ clientId: "1.2", sessionId: null }, "begin_checkout", { value: 36.5, currency: "USD", planKey: "p2_1k_m" });
    expect(payload.events[0].name).toBe("begin_checkout");
    expect(payload.events[0].params).not.toHaveProperty("transaction_id");
    expect(payload.events[0].params).not.toHaveProperty("session_id");
  });
});
