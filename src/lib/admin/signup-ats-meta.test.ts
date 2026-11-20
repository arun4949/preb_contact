import { describe, expect, it } from "vitest";
import { SIGNUP_ATS_OPTIONS } from "@/lib/onboarding/signup-ats";
import { SIGNUP_ATS_STATUS_META, signupAtsLabel } from "./signup-ats-meta";
import { SIGNUP_SOURCE_STATUSES } from "./signup-source-meta";

describe("signup ATS labels", () => {
  it("has a label and a description for every status", () => {
    for (const status of SIGNUP_SOURCE_STATUSES) {
      expect(SIGNUP_ATS_STATUS_META[status].label).toBeTruthy();
      expect(SIGNUP_ATS_STATUS_META[status].description).toBeTruthy();
    }
  });

  it("names every option and keeps a removed key readable", () => {
    for (const option of SIGNUP_ATS_OPTIONS) expect(signupAtsLabel(option.key)).toBe(option.short ?? option.label);
    expect(signupAtsLabel("none")).toBe("No ATS");
    expect(signupAtsLabel("recruit_crm")).toBe("Recruit CRM");
    expect(signupAtsLabel("smart_recruiters")).toBe("Smart recruiters");
  });

  it("uses no dash as punctuation", () => {
    for (const status of SIGNUP_SOURCE_STATUSES) {
      for (const text of [SIGNUP_ATS_STATUS_META[status].label, SIGNUP_ATS_STATUS_META[status].description]) expect(text).not.toMatch(/[—–]| - /);
    }
  });
});
