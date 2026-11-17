import { describe, expect, it } from "vitest";
import { percent, plural, rowRange } from "./format";

describe("rowRange", () => {
  it("shows the first and last row of the page", () => {
    expect(rowRange(1, 25, 25, 120)).toBe("1–25 of 120");
    expect(rowRange(2, 25, 25, 120)).toBe("26–50 of 120");
    expect(rowRange(5, 25, 20, 1120)).toBe("101–120 of 1,120");
  });

  it("names a single row once", () => {
    expect(rowRange(1, 25, 1, 1)).toBe("1 of 1");
    expect(rowRange(4, 5, 1, 16)).toBe("16 of 16");
  });
});

describe("percent and plural", () => {
  it("rounds to whole percent and never divides by zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBeNull();
  });

  it("picks the right noun", () => {
    expect(plural(1, "draft", "drafts")).toBe("1 draft");
    expect(plural(2500, "credit", "credits")).toBe("2,500 credits");
  });
});
