import { describe, expect, it } from "vitest";
import { SIGNUP_SOURCE_OPTIONS } from "@/lib/onboarding/signup-source";
import { SIGNUP_SOURCE_NOT_ASKED, SIGNUP_SOURCE_STATUSES, SIGNUP_SOURCE_STATUS_META, signupSourceLabel, signupSourceStatus } from "./signup-source-meta";

describe("signup source labels", () => {
  it("has a label and a description for every status", () => {
    for (const status of SIGNUP_SOURCE_STATUSES) {
      expect(SIGNUP_SOURCE_STATUS_META[status].label).toBeTruthy();
      expect(SIGNUP_SOURCE_STATUS_META[status].description).toBeTruthy();
    }
  });

  it("names every option and keeps a removed key readable", () => {
    for (const option of SIGNUP_SOURCE_OPTIONS) expect(signupSourceLabel(option.key)).toBe(option.short ?? option.label);
    expect(signupSourceLabel("ai_assistant")).toBe("AI assistant");
    expect(signupSourceLabel("review_site")).toBe("Review site");
  });

  it("treats an unknown status as no response", () => {
    expect(signupSourceStatus("answered")).toBe("answered");
    expect(signupSourceStatus("whatever")).toBe("pending");
  });

  it("uses no dash as punctuation", () => {
    const texts = [SIGNUP_SOURCE_NOT_ASKED, ...SIGNUP_SOURCE_STATUSES.flatMap((s) => [SIGNUP_SOURCE_STATUS_META[s].label, SIGNUP_SOURCE_STATUS_META[s].description])];
    for (const text of texts) expect(text).not.toMatch(/[—–]| - /);
  });
});
