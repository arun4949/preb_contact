"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getProfile, getSessionContext } from "@/lib/supabase/queries";
import { createOwnWorkspace } from "@/lib/workspace/create";
import { sendEmail } from "@/lib/email/resend";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

export interface OnboardingState {
  /** `done` → the form performs a full navigation to /lists (see onboarding-form.tsx). */
  status: "idle" | "error" | "done";
  message?: string;
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

  const supabase = await createClient();
  const session = await getSessionContext();

  let workspaceId: string;
  let finalWorkspaceName: string;
  let trialCredits: number;

  if (session) {
    // First login: the signup trigger already created (or joined) the workspace; owners name it.
    const [profileResult, workspaceResult] = await Promise.all([
      supabase.from("profiles").update({ full_name: fullName, onboarded_at: new Date().toISOString() }).eq("id", profile.id),
      session.role === "owner"
        ? supabase.from("workspaces").update({ name: workspaceName }).eq("id", session.workspace.id)
        : Promise.resolve({ error: null }),
    ]);
    if (profileResult.error || workspaceResult.error) return { status: "error", message: SAVE_FAILED };
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
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, onboarded_at: profile.onboarded_at ?? new Date().toISOString() })
      .eq("id", profile.id);
    if (error) return { status: "error", message: SAVE_FAILED };
    workspaceId = created;
    finalWorkspaceName = workspaceName;
    trialCredits = 0;
  }

  // Welcome email, once, after the workspace is named. Never blocks onboarding.
  if (!profile.onboarded_at) {
    try {
      await sendEmail({
        to: profile.email,
        kind: "welcome",
        workspaceId,
        subject: "Welcome to Preb — your workspace is ready",
        react: WelcomeEmail({ firstName: fullName.split(/\s+/)[0] ?? "", workspaceName: finalWorkspaceName, trialCredits }),
      });
    } catch (error) {
      console.error("[completeOnboarding] welcome email failed", error instanceof Error ? error.message : error);
    }
  }

  // No `redirect()` here: the action runs under the (auth) layout and the
  // target lives under the (app) layout. A server-action redirect across the
  // two groups left the client router re-fetching /lists in a loop on prod
  // (blank, flickering page); a full navigation starts from a clean tree.
  return DONE;
}
