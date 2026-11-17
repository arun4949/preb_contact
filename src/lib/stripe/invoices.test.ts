import { describe, expect, it, vi } from "vitest";

const list = vi.fn();
let live = false;
vi.mock("./client", () => ({ stripe: () => ({ invoices: { list } }), isLiveMode: () => live }));

const { listCustomerInvoices, stripeCustomerUrl } = await import("./invoices");

const invoice = (over: Record<string, unknown>) => ({
  id: "in_1",
  number: "PREB-0001",
  created: 1794861811,
  status: "paid",
  amount_paid: 9900,
  amount_due: 9900,
  currency: "usd",
  hosted_invoice_url: "https://invoice.stripe.com/i/1",
  description: null,
  lines: { data: [{ description: "Preb 500" }] },
  ...over,
});

describe("listCustomerInvoices", () => {
  // Runs first, so `list` has no calls yet.
  it("does not call Stripe for a workspace without a customer", async () => {
    expect(await listCustomerInvoices(null)).toEqual({ state: "none" });
    expect(list).not.toHaveBeenCalled();
  });

  it("adds up paid invoices only", async () => {
    list.mockResolvedValue({
      has_more: false,
      data: [invoice({}), invoice({ id: "in_2", amount_paid: 3700, description: "Overspend" }), invoice({ id: "in_3", status: "open", amount_paid: 0 }), invoice({ id: "in_4", status: "void", amount_paid: 0 })],
    });
    const result = await listCustomerInvoices("cus_1");
    expect(list).toHaveBeenCalledWith({ customer: "cus_1", limit: 100 });
    if (result.state !== "ok") throw new Error("expected ok");
    expect(result.totalPaidCents).toBe(13600);
    expect(result.invoices).toHaveLength(4);
    expect(result.invoices[0].description).toBe("Preb 500");
    expect(result.invoices[1].description).toBe("Overspend");
    expect(result.invoices[0].createdAt).toBe(new Date(1794861811000).toISOString());
    expect(result.hasMore).toBe(false);
  });

  it("reports when Stripe has more invoices than one page", async () => {
    list.mockResolvedValue({ has_more: true, data: [invoice({})] });
    const result = await listCustomerInvoices("cus_1");
    expect(result.state === "ok" && result.hasMore).toBe(true);
  });

  it("is an empty, valid result for a customer without invoices", async () => {
    list.mockResolvedValue({ has_more: false, data: [] });
    expect(await listCustomerInvoices("cus_1")).toEqual({ state: "ok", invoices: [], totalPaidCents: 0, currency: "usd", hasMore: false });
  });

  it("treats a customer from the other Stripe mode as such, not as an error", async () => {
    list.mockImplementation(async () => {
      throw Object.assign(new Error("No such customer"), { code: "resource_missing" });
    });
    expect(await listCustomerInvoices("cus_live")).toEqual({ state: "other_mode" });
  });

  it("returns other failures as an error state instead of throwing", async () => {
    list.mockImplementation(async () => {
      throw new Error("network");
    });
    expect(await listCustomerInvoices("cus_1")).toEqual({ state: "error", message: "network" });
  });
});

describe("stripeCustomerUrl", () => {
  it("points at the test dashboard for a test key and the live one for a live key", () => {
    live = false;
    expect(stripeCustomerUrl("cus_1")).toBe("https://dashboard.stripe.com/test/customers/cus_1");
    live = true;
    expect(stripeCustomerUrl("cus_1")).toBe("https://dashboard.stripe.com/customers/cus_1");
  });
});
