import { describe, expect, it } from "vitest";
import { signupStage } from "./signup-stage";

describe("signupStage", () => {
  it("is onboarded once the setup was finished, whatever the sign-in lookup says", () => {
    expect(signupStage({ onboardedAt: "2026-11-11T04:40:31Z", lastSignInAt: undefined })).toBe("onboarded");
    expect(signupStage({ onboardedAt: "2026-11-11T04:40:31Z", lastSignInAt: null })).toBe("onboarded");
  });

  it("is signed in when the person logged in but never finished the setup", () => {
    expect(signupStage({ onboardedAt: null, lastSignInAt: "2026-11-09T08:59:24Z" })).toBe("signed_in");
  });

  it("is only a requested code when nobody ever logged in", () => {
    expect(signupStage({ onboardedAt: null, lastSignInAt: null })).toBe("code_requested");
  });

  it("never guesses when the sign-in lookup failed", () => {
    expect(signupStage({ onboardedAt: null, lastSignInAt: undefined })).toBe("unknown");
  });
});
