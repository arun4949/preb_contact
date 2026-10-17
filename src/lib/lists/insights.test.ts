import { describe, expect, it } from "vitest";
import { EMPTY_INSIGHTS, emailFound, shapeInsights } from "./insights";

describe("insights", () => {
  it("shapes the SQL json and defaults every missing key to zero", () => {
    expect(shapeInsights(null)).toEqual(EMPTY_INSIGHTS);
    expect(shapeInsights("x")).toEqual(EMPTY_INSIGHTS);
    const shaped = shapeInsights({
      processed: 19,
      work_email: { valid: 8, probable: 4, catch_all: 2, not_found: 5, multi: 0 },
      phone: { found: "14", mobile: 14, connect: { highest: 13, high: 1 }, ownership: { confirmed: 14 } },
      identified: -2,
    });
    expect(shaped.processed).toBe(19);
    expect(emailFound(shaped.work_email)).toBe(14);
    expect(shaped.personal_email).toEqual(EMPTY_INSIGHTS.personal_email);
    expect(shaped.phone.found).toBe(14);
    expect(shaped.phone.connect).toEqual({ highest: 13, high: 1, medium: 0, unrated: 0 });
    expect(shaped.phone.ownership.confirmed).toBe(14);
    expect(shaped.phone.landline).toBe(0);
    expect(shaped.identified).toBe(0);
  });
});
