"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getProfile, getSessionContext } from "@/lib/supabase/queries";
import { createOwnWorkspace } from "@/lib/workspace/create";
import { sendEmail } from "@/lib/email/resend";
import { subscribeContact } from "@/lib/email/contacts";
import { firstNameFor } from "@/lib/email/name";
import { normalizePhone } from "@/lib/phone/phone";
import { WelcomeEmail } from "@/lib/email/templates/welcome";
import { attributeLeadSignup } from "@/lib/leads/attribution";

export interface OnboardingState {
  /** `done` → the form performs a full navigation to /lists (see onboarding-form.tsx). */
  status: "idle" | "error" | "done";
  message?: string;
  /** Set when the error belongs to one field (shown inline instead of the banner). */
  field?: "phone";
}

const DONE: OnboardingState = { status: "done" };

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
  }

  // No `redirect()` here: the action runs under the (auth) layout and the
  // target lives under the (app) layout. A server-action redirect across the
  // two groups left the client router re-fetching /lists in a loop on prod
  // (blank, flickering page); a full navigation starts from a clean tree.
  return DONE;
}
