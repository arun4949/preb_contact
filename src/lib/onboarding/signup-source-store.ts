import "server-only";

import { metaAttribution } from "@/lib/admin/attribution";
import { log, logError } from "@/lib/jobs/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSignupSourceFresh, shownPosition, signupSourceOrder, type SignupSourceAnswer } from "./signup-source";

/**
 * Storage for the optional second onboarding step (`signup_sources`, migration
 * 0035). The table is service role only, so every call here runs after the
 * caller verified the signed-in user and passes that user's own id.
 *
 * Nothing here may ever block onboarding: a failed write means the person is
 * simply not asked, and every function swallows its errors.
 */

/**
 * Marks a new workspace owner as asked. Called once by the onboarding action
 * when step 1 completes. An existing row is left alone (double submit), so
 * `asked_at` and an answer already given survive.
 *
 * The Meta verdict is stored as a category because the click context it comes
 * from is deleted after 90 days; the identifiers themselves are not copied.
 */
export async function createPendingSignupSource(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: context, error: contextError } = await admin.from("meta_click_contexts").select("fbc, fbp").eq("user_id", userId).maybeSingle();
    const { error } = await admin.from("signup_sources").upsert(
      {
        user_id: userId,
        status: "pending",
        options_shown: signupSourceOrder(userId),
        // Unknown when the lookup failed: null, never a guessed "none".
        meta_attribution: contextError ? null : metaAttribution(context),
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    logError("signup_source.create_failed", error, { userId });
  }
}

/**
 * True when this person should see the question now: asked, not answered or
 * skipped yet, and asked recently. False on any error, so a broken read sends
 * people to the app instead of into a step that cannot save.
 */
export async function hasFreshPendingSignupSource(userId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().from("signup_sources").select("status, asked_at").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data && data.status === "pending" && isSignupSourceFresh(data.asked_at));
  } catch (error) {
    logError("signup_source.read_failed", error, { userId });
    return false;
  }
}

/** Stores the answer once. A row that is no longer pending is left as it is. */
export async function saveSignupSourceAnswer(userId: string, answer: SignupSourceAnswer): Promise<void> {
  try {
    const order = signupSourceOrder(userId);
    const { error } = await createAdminClient()
      .from("signup_sources")
      .update({
        status: "answered",
        source: answer.source,
        detail: answer.detail,
        options_shown: order,
        shown_position: shownPosition(order, answer.source),
        responded_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    log("signup_source.answered", { userId, source: answer.source, hasDetail: Boolean(answer.detail) });
  } catch (error) {
    logError("signup_source.answer_failed", error, { userId });
  }
}

export async function saveSignupSourceSkip(userId: string): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("signup_sources")
      .update({ status: "skipped", responded_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    log("signup_source.skipped", { userId });
  } catch (error) {
    logError("signup_source.skip_failed", error, { userId });
  }
}
