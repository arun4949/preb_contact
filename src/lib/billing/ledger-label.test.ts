import { describe, expect, it } from "vitest";
import { ledgerLabel } from "./ledger-label";

describe("ledgerLabel", () => {
  it("shows the grant note, or a generic label without one", () => {
    expect(ledgerLabel({ kind: "grant", note: "Welcome trial", listName: null })).toBe("Welcome trial");
    expect(ledgerLabel({ kind: "grant", note: null, listName: null })).toBe("Credits granted");
  });

  it("names the list for enrichment and overspend", () => {
    expect(ledgerLabel({ kind: "consume", note: null, listName: "Q4 prospects" })).toBe("Enrichment · Q4 prospects");
    expect(ledgerLabel({ kind: "consume", note: "Internal workspace, not charged", listName: null })).toBe("Enrichment");
    expect(ledgerLabel({ kind: "overage", note: "Overspend, charged to your payment method", listName: "Q4 prospects" })).toBe("Overspend · Q4 prospects");
    expect(ledgerLabel({ kind: "overage", note: null, listName: null })).toBe("Overspend");
  });

  it("labels expiry and adjustments", () => {
    expect(ledgerLabel({ kind: "expire", note: "Credits expired", listName: null })).toBe("Credits expired");
    expect(ledgerLabel({ kind: "adjust", note: "Overdraft absorbed", listName: "Q4 prospects" })).toBe("Overdraft absorbed");
    expect(ledgerLabel({ kind: "adjust", note: null, listName: null })).toBe("Adjustment");
  });
});
