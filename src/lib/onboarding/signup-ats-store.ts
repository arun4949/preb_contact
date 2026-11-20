import "server-only";

import { log, logError } from "@/lib/jobs/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SignupAtsAnswer } from "./signup-ats";
import { isSignupSourceFresh } from "./signup-source";

/**
 * Storage for the optional third onboarding step (`signup_ats`, migration
 * 0036). The table is service role only, so every call here runs after the
 * caller verified the signed-in user and passes that user's own id.
 *
 * Nothing here may ever block onboarding: a failed write means the person is
 * simply not asked, and every function swallows its errors.
 */

/**
 * Marks a new workspace owner as asked. Called once by the onboarding action
 * when step 1 completes, together with the source row. An existing row is left
 * alone (double submit), so `asked_at` and an answer already given survive.
 */
export async function createPendingSignupAts(userId: string): Promise<void> {
  try {
    const { error } = await createAdminClient().from("signup_ats").upsert({ user_id: userId, status: "pending" }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } catch (error) {
    logError("signup_ats.create_failed", error, { userId });
  }
}

/**
 * True when this person should see the question now: asked, not answered or
 * skipped yet, and asked recently (same window as the source question). False
 * on any error, so a broken read sends people to the app instead of into a
 * step that cannot save.
 */
export async function hasFreshPendingSignupAts(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().from("signup_ats").select("status, asked_at").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data && data.status === "pending" && isSignupSourceFresh(data.asked_at));
  } catch (error) {
    logError("signup_ats.read_failed", error, { userId });
    return false;
  }
}

/** Stores the answer once. A row that is no longer pending is left as it is. */
export async function saveSignupAtsAnswer(userId: string, answer: SignupAtsAnswer): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("signup_ats")
      .update({ status: "answered", ats: answer.ats, detail: answer.detail, responded_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    log("signup_ats.answered", { userId, ats: answer.ats, hasDetail: Boolean(answer.detail) });
  } catch (error) {
    logError("signup_ats.answer_failed", error, { userId });
  }
}

export async function saveSignupAtsSkip(userId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("signup_ats")
      .update({ status: "skipped", responded_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    log("signup_ats.skipped", { userId });
  } catch (error) {
    logError("signup_ats.skip_failed", error, { userId });
  }
}
