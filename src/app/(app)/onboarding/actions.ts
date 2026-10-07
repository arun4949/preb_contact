"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSessionContext } from "@/lib/supabase/queries";

export interface OnboardingState {
  status: "idle" | "error";
  message?: string;
}

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const fullName = String(formData.get("full_name") ?? "").trim();
  const workspaceName = String(formData.get("workspace_name") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 80) return { status: "error", message: "Enter your full name." };
  if (workspaceName.length < 1 || workspaceName.length > 80) return { status: "error", message: "Enter a workspace name." };

  const supabase = await createClient();
  const [profileResult, workspaceResult] = await Promise.all([
    supabase
      .from("profiles")
      .update({ full_name: fullName, onboarded_at: new Date().toISOString() })
      .eq("id", session.userId),
    session.role === "owner"
      ? supabase.from("workspaces").update({ name: workspaceName }).eq("id", session.workspace.id)
      : Promise.resolve({ error: null }),
  ]);

  if (profileResult.error || workspaceResult.error) {
    return { status: "error", message: "Something went wrong saving your details. Please try again." };
  }

  redirect("/lists");
}
