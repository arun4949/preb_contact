"use server";

import { redirect } from "next/navigation";
import { parseSignupAtsAnswer } from "@/lib/onboarding/signup-ats";
import { saveSignupAtsAnswer, saveSignupAtsSkip } from "@/lib/onboarding/signup-ats-store";
import { getUser } from "@/lib/supabase/queries";

export interface SignupAtsState {
  /** `done` → the form performs a full navigation to /lists (see ats-form.tsx). */
  status: "idle" | "error" | "done";
  message?: string;
}

/**
 * The optional third onboarding step: stores the answer or the skip, then the
 * form moves on to the app. The step must never hold anyone back, so a failed
 * write still ends in `done` (the store logs it) and a repeated submit (back
 * button, second tab) changes nothing: only a pending row is updated.
 *
 * No `redirect()` to the app here, for the reason given in ../actions.ts.
 */
export async function submitSignupAts(_prev: SignupAtsState, formData: FormData): Promise<SignupAtsState> {
  const user = await getUser();
  if (!user) redirect("/login");

  if (formData.get("intent") === "skip") {
    await saveSignupAtsSkip(user.id);
    return { status: "done" };
  }

  const answer = parseSignupAtsAnswer(formData.get("ats"), formData.get("detail"));
  if (!answer) return { status: "error", message: "Choose an option, or skip this step." };
  await saveSignupAtsAnswer(user.id, answer);
  return { status: "done" };
}
