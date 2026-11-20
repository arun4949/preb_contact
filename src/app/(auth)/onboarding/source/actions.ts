"use server";

import { redirect } from "next/navigation";
import { SIGNUP_SOURCE_PATH, parseSignupSourceAnswer } from "@/lib/onboarding/signup-source";
import { saveSignupSourceAnswer, saveSignupSourceSkip } from "@/lib/onboarding/signup-source-store";
import { ONBOARDING_DONE_PATH } from "@/lib/onboarding/steps";
import { nextOnboardingPathFor } from "@/lib/onboarding/steps-store";
import { getUser } from "@/lib/supabase/queries";

export interface SignupSourceState {
  /** `done` → the form performs a full navigation to `next` (see source-form.tsx). */
  status: "idle" | "error" | "done";
  message?: string;
  /** The ATS question when it is still open, else the app. */
  next?: string;
}

/**
 * The optional second onboarding step: stores the answer or the skip, then the
 * form moves on to the third step or the app. The step must never hold anyone back, so a failed
 * write still ends in `done` (the store logs it) and a repeated submit (back
 * button, second tab) changes nothing: only a pending row is updated.
 *
 * No `redirect()` to the app here, for the reason given in ../actions.ts.
 */
export async function submitSignupSource(_prev: SignupSourceState, formData: FormData): Promise<SignupSourceState> {
  const user = await getUser();
  if (!user) redirect("/login");

  if (formData.get("intent") === "skip") {
    await saveSignupSourceSkip(user.id);
    return { status: "done", next: await nextStep(user.id) };
  }

  const answer = parseSignupSourceAnswer(formData.get("source"), formData.get("detail"));
  if (!answer) return { status: "error", message: "Choose an option, or skip this step." };
  await saveSignupSourceAnswer(user.id, answer);
  return { status: "done", next: await nextStep(user.id) };
}

/**
 * Never back to this step: when the write above failed the source row is still
 * pending, and sending the person here again would loop.
 */
async function nextStep(userId: string): Promise<string> {
  const next = await nextOnboardingPathFor(userId);
  return next === SIGNUP_SOURCE_PATH ? ONBOARDING_DONE_PATH : next;
}
