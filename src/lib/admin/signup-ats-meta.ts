import { signupAtsOption } from "@/lib/onboarding/signup-ats";
import type { SignupSourceStatus } from "./signup-source-meta";

/**
 * How the admin pages name the self-reported ATS (the optional third
 * onboarding step, `signup_ats`). The statuses are the ones of the source
 * question (`signup-source-meta.ts`). Client-safe.
 */
export const SIGNUP_ATS_STATUS_META: Record<SignupSourceStatus, { label: string; description: string }> = {
  answered: { label: "Answered", description: "Picked an option in the third onboarding step." },
  skipped: { label: "Skipped", description: "Saw the question and chose to skip it." },
  pending: { label: "No response", description: "Was asked and left without answering or skipping." },
};

/** The short option name, or the stored key made readable when the option was removed from the list since. */
export function signupAtsLabel(key: string): string {
  const option = signupAtsOption(key);
  if (option) return option.short ?? option.label;
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
