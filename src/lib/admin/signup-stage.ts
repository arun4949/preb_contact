/**
 * How far a new account got. An account (and its workspace) is created the
 * moment someone requests a sign-in code, so "an account exists" is only a
 * lead: Ops shows the stage next to each row so leads and real signups are
 * never mixed up (found on 2026-11-13 when three ad accounts were read as
 * three signups and Meta had, correctly, counted one).
 */
export type SignupStage = "onboarded" | "signed_in" | "code_requested" | "unknown";

export interface SignupStageInput {
  onboardedAt: string | null;
  /** `auth.users.last_sign_in_at`; `undefined` when the lookup failed. */
  lastSignInAt: string | null | undefined;
}

export function signupStage({ onboardedAt, lastSignInAt }: SignupStageInput): SignupStage {
  if (onboardedAt) return "onboarded";
  if (lastSignInAt === undefined) return "unknown";
  return lastSignInAt ? "signed_in" : "code_requested";
}

export const SIGNUP_STAGE_META: Record<SignupStage, { label: string; color: "lime" | "blue" | "neutral" }> = {
  onboarded: { label: "Onboarded", color: "lime" },
  signed_in: { label: "Signed in", color: "blue" },
  code_requested: { label: "Code requested", color: "neutral" },
  unknown: { label: "Unknown", color: "neutral" },
};
