import { signupSourceOption } from "@/lib/onboarding/signup-source";

/**
 * How the admin pages name the self-reported acquisition source (the optional
 * second onboarding step, `signup_sources`). Client-safe.
 */
export const SIGNUP_SOURCE_STATUSES = ["answered", "skipped", "pending"] as const;
export type SignupSourceStatus = (typeof SIGNUP_SOURCE_STATUSES)[number];

export function signupSourceStatus(value: string): SignupSourceStatus {
  return (SIGNUP_SOURCE_STATUSES as readonly string[]).includes(value) ? (value as SignupSourceStatus) : "pending";
}

export const SIGNUP_SOURCE_STATUS_META: Record<SignupSourceStatus, { label: string; description: string }> = {
  answered: { label: "Answered", description: "Picked an option in the second onboarding step." },
  skipped: { label: "Skipped", description: "Saw the question and chose to skip it." },
  pending: { label: "No response", description: "Saw the question and left without answering or skipping." },
};

/** Shown when an account has no row at all: accounts from before the question and invited teammates. */
export const SIGNUP_SOURCE_NOT_ASKED = "Not asked";

/** The short option name, or the stored key made readable when the option was removed from the list since. */
export function signupSourceLabel(key: string): string {
  const option = signupSourceOption(key);
  if (option) return option.short ?? option.label;
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
