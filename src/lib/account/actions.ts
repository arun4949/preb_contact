"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import { setContactSubscribed } from "@/lib/email/contacts";
import { deleteUserCompletely, deleteWorkspaceData, DeletionBlockedError } from "@/lib/account/deletion";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function updateProfileName(fullName: string): Promise<Result> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Not signed in" };
  const name = fullName.trim();
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Enter your full name (2–80 characters)." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", session.userId);
  if (error) return { ok: false, error: "Could not save your name." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Settings › Profile › Product news. The profile flag is the source of truth
 * for the UI; the Resend contact is mirrored best-effort (the Resend webhook
 * brings unsubscribes from emails back into the profile).
 */
export async function updateProductNews(enabled: boolean): Promise<Result> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ product_news: enabled }).eq("id", session.userId);
  if (error) return { ok: false, error: "Could not save your email preference." };
  await setContactSubscribed({ email: session.email, fullName: session.profile.full_name, subscribed: enabled });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/**
 * Owner-only. Deletes the current workspace with every list, contact, file and
 * credit; cancels the Stripe subscription immediately. The caller must type
 * the workspace name. Returns where the actor should go next.
 */
export async function deleteWorkspace(confirmName: string): Promise<Result<{ redirectTo: string }>> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Not signed in" };
  if (session.role !== "owner") return { ok: false, error: "Only the workspace owner can delete it." };
  if (confirmName.trim() !== session.workspace.name) return { ok: false, error: "The name you typed does not match the workspace name." };

  const admin = createAdminClient();
  try {
    await deleteWorkspaceData(admin, session.workspace, session.userId);
  } catch (error) {
    console.error("[deleteWorkspace] failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "The workspace could not be deleted. Nothing was removed, please try again or contact support." };
  }
  const { data: other } = await admin.from("workspace_members").select("workspace_id").eq("user_id", session.userId).limit(1).maybeSingle();
  revalidatePath("/", "layout");
  return { ok: true, data: { redirectTo: other ? "/lists" : "/onboarding" } };
}

/**
 * Deletes the signed-in user's account: owned workspaces with all their data,
 * memberships elsewhere, the auth user, the Resend contact and the email log.
 * The caller must type their email address. Signs the session out afterwards.
 */
export async function deleteAccount(confirmEmail: string): Promise<Result<{ redirectTo: string }>> {
  const session = await getSessionContext();
  if (!session) return { ok: false, error: "Not signed in" };
  if (confirmEmail.trim().toLowerCase() !== session.email.toLowerCase()) return { ok: false, error: "The address you typed does not match your sign-in email." };

  const admin = createAdminClient();
  try {
    await deleteUserCompletely(admin, session.userId);
  } catch (error) {
    if (error instanceof DeletionBlockedError) return { ok: false, error: error.message };
    console.error("[deleteAccount] failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "Your account could not be deleted. Please try again or contact support." };
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { ok: true, data: { redirectTo: "/login?notice=account_deleted" } };
}
