import { describe, expect, it } from "vitest";
import { SIGNUP_ATS_PATH } from "./signup-ats";
import { SIGNUP_SOURCE_PATH } from "./signup-source";
import { ONBOARDING_DONE_PATH, nextOnboardingPath } from "./steps";

describe("nextOnboardingPath", () => {
  it("asks the source question first", () => {
    expect(nextOnboardingPath({ source: true, ats: true })).toBe(SIGNUP_SOURCE_PATH);
    expect(nextOnboardingPath({ source: true, ats: false })).toBe(SIGNUP_SOURCE_PATH);
  });

  it("asks the ATS question once the source question is closed", () => {
    expect(nextOnboardingPath({ source: false, ats: true })).toBe(SIGNUP_ATS_PATH);
  });

  it("ends in the app when nothing is open", () => {
    expect(nextOnboardingPath({ source: false, ats: false })).toBe(ONBOARDING_DONE_PATH);
    expect(ONBOARDING_DONE_PATH).toBe("/lists");
  });
});
