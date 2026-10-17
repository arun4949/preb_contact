import { describe, expect, it } from "vitest";
import { CONNECT_RATE_META, EMAIL_LEVEL_META, OWNERSHIP_META, emailLevel } from "./email-levels";

describe("email levels", () => {
  it("maps provider statuses to the three shown levels", () => {
    expect(emailLevel("DELIVERABLE")).toBe("valid");
    expect(emailLevel("HIGH_PROBABILITY")).toBe("probable");
    expect(emailLevel("CATCH_ALL")).toBe("catch_all");
    expect(emailLevel("INVALID")).toBeNull();
    expect(emailLevel("INVALID_DOMAIN")).toBeNull();
    expect(emailLevel(null)).toBeNull();
    expect(emailLevel("whatever")).toBeNull();
  });

  it("keeps the copy free of dashes as punctuation, provider names and the old wording", () => {
    const texts = [
      ...Object.values(EMAIL_LEVEL_META).flatMap((m) => [m.label, m.title, m.description, m.bounce]),
      ...Object.values(CONNECT_RATE_META).flatMap((m) => [m.label, m.title, m.description]),
      ...Object.values(OWNERSHIP_META).flatMap((m) => [m.title, m.description()]),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/[—–]| - /);
      expect(t).not.toMatch(/fullenrich|wiza|contactout/i);
      expect(t).not.toMatch(/risky/i);
    }
  });
});
