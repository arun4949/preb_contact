"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getProfile, getSessionContext } from "@/lib/supabase/queries";
import { createOwnWorkspace } from "@/lib/workspace/create";
import { sendEmail } from "@/lib/email/resend";
import { subscribeContact } from "@/lib/email/contacts";
import { firstNameFor } from "@/lib/email/name";
import { normalizePhone } from "@/lib/phone/phone";
import { WelcomeEmail } from "@/lib/email/templates/welcome";
import { attributeLeadSignup } from "@/lib/leads/attribution";
import { attributeReferralSignup, clearReferralCookie, readReferralCookie } from "@/lib/referrals/attribution";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMetaEvent } from "@/lib/meta/capi";
import { readMetaClickContext } from "@/lib/meta/click-context";
import { isMetaEventId } from "@/lib/meta/client";
import { createPendingSignupAts } from "@/lib/onboarding/signup-ats-store";
import { createPendingSignupSource } from "@/lib/onboarding/signup-source-store";
import { ONBOARDING_DONE_PATH } from "@/lib/onboarding/steps";
import { nextOnboardingPathFor } from "@/lib/onboarding/steps-store";

export interface OnboardingState {
  /** `done` → the form performs a full navigation to `next` (see onboarding-form.tsx). */
  status: "idle" | "error" | "done";
  /** Where to go after `done`: the optional second step for a new owner, otherwise the app. */
  next?: string;
  message?: string;
  /** Set when the error belongs to one field (shown inline instead of the banner). */
  field?: "phone";
}

const DONE: OnboardingState = { status: "done", next: "/lists" };

const SAVE_FAILED = "Something went wrong saving your details. Please try again.";

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const workspaceName = String(formData.get("workspace_name") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) return { status: "error", message: "Enter your full name." };
  if (workspaceName.length < 1 || workspaceName.length > 80) return { status: "error", message: "Enter a workspace name." };

  // Optional phone: the raw text plus the selected country, normalised here
  // (same library as the field) so an invalid number is never silently dropped.
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phoneCountry = String(formData.get("phone_country") ?? "");
  const phone = phoneRaw ? normalizePhone(phoneRaw, phoneCountry) : null;
  if (phoneRaw && !phone) return { status: "error", field: "phone", message: "Enter a valid phone number, or leave it empty." };

  const supabase = await createClient();
  const session = await getSessionContext();
  // Upsert without a representation: only the insert and update policies apply,
  // and `calls_allowed` is not in the body, so a re-run keeps the stored consent.
  const savePhone = () =>
    phone
      ? supabase.from("profile_phones").upsert({ user_id: profile.id, phone: phone.e164, country: phone.country }, { onConflict: "user_id" })
      : Promise.resolve({ error: null });

  let workspaceId: string;
  let finalWorkspaceName: string;
  let trialCredits: number;

  if (session) {
    // First login: the signup trigger already created (or joined) the workspace; owners name it.
    const [profileResult, workspaceResult, phoneResult] = await Promise.all([
      supabase.from("profiles").update({ full_name: fullName, onboarded_at: new Date().toISOString() }).eq("id", profile.id),
      session.role === "owner"
        ? supabase.from("workspaces").update({ name: workspaceName }).eq("id", session.workspace.id)
        : Promise.resolve({ error: null }),
      savePhone(),
    ]);
    if (profileResult.error || workspaceResult.error || phoneResult.error) return { status: "error", message: SAVE_FAILED };
    workspaceId = session.workspace.id;
    finalWorkspaceName = session.role === "owner" ? workspaceName : session.workspace.name;
    trialCredits = session.creditsAvailable;
  } else {
    // No workspace at all (removed from the only one): create a fresh one, no trial.
    let created: string | null;
    try {
      created = await createOwnWorkspace(profile.id, workspaceName);
    } catch (error) {
      console.error("[completeOnboarding] workspace create failed", error instanceof Error ? error.message : error);
      return { status: "error", message: SAVE_FAILED };
    }
    // Null = a membership appeared meanwhile (double submit or a new invite); just continue to the app.
    if (!created) return DONE;
    const [{ error }, phoneResult] = await Promise.all([
      supabase
        .from("profiles")
        .update({ full_name: fullName, onboarded_at: profile.onboarded_at ?? new Date().toISOString() })
        .eq("id", profile.id),
      savePhone(),
    ]);
    if (error || phoneResult.error) return { status: "error", message: SAVE_FAILED };
    workspaceId = created;
    finalWorkspaceName = workspaceName;
    trialCredits = 0;
  }

  // Welcome email + Resend contact, once, after the workspace is named. Never blocks onboarding.
  if (!profile.onboarded_at) {
    // The two optional questions ("How did you first hear about Preb?", then
    // "Which ATS do you use?"): new owners only. Written first, so a slow email or
    // attribution call below can never leave an onboarded owner without the rows.
    // Best effort: without a row the person is simply not asked that question.
    if (session?.role === "owner") await Promise.all([createPendingSignupSource(profile.id), createPendingSignupAts(profile.id)]);
    const firstName = firstNameFor(fullName, profile.email);
    const welcome = async () => {
      try {
        await sendEmail({
          to: profile.email,
          kind: "welcome",
          workspaceId,
          subject: firstName ? `Welcome to Preb, ${firstName}` : "Welcome to Preb, your workspace is ready",
          react: WelcomeEmail({ firstName, workspaceName: finalWorkspaceName, trialCredits }),
        });
      } catch (error) {
        console.error("[completeOnboarding] welcome email failed", error instanceof Error ? error.message : error);
      }
    };
    await Promise.all([welcome(), subscribeContact({ email: profile.email, fullName })]);
    // Lead magnet: credit the share this signup came from (cookie set by /l/<token>/go).
    await attributeLeadSignup(profile.id);
    // Invite friends: belt and braces for the magic-link and Google paths (idempotent), then the cookie goes.
    if (session?.role === "owner") {
      const ref = await readReferralCookie();
      if (ref) await attributeReferralSignup(createAdminClient(), profile.id, ref, "onboarding");
    }
    await clearReferralCookie();
    // Meta Ads: the signup conversion, once per new owner. Same event id as the
    // browser pixel event fired by the form, so Meta deduplicates the pair.
    // The click context stored at account creation covers the case where the
    // sign-in link or code was used in a browser other than the one that
    // clicked the ad (no `_fbc`/`_fbp` and no consent cookie here).
    const metaEventId = formData.get("meta_event_id");
    if (session && isMetaEventId(metaEventId)) {
      after(async () => {
        const stored = await readMetaClickContext(createAdminClient(), profile.id);
        await sendMetaEvent({ eventName: "CompleteRegistration", eventId: metaEventId, userData: { email: profile.email, externalId: profile.id } }, { stored });
      });
    }
  }

  // No `redirect()` here: the action runs under the (auth) layout and the
  // target lives under the (app) layout. A server-action redirect across the
  // two groups left the client router re-fetching /lists in a loop on prod
  // (blank, flickering page); a full navigation starts from a clean tree.
  //
  // The destination is read from the rows, not from "this call wrote it": a second
  // submit (another tab) skips the block above, and /onboarding redirects by the
  // same check, so the action and the page always agree.
  if (session?.role === "owner") {
    const next = await nextOnboardingPathFor(profile.id);
    if (next !== ONBOARDING_DONE_PATH) return { status: "done", next };
  }
  return DONE;
}
