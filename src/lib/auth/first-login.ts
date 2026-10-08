import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { subscribeContact } from "@/lib/email/contacts";

/**
 * First sign-in of an invitee the signup trigger already joined to a
 * workspace: they skip onboarding (owners only), so mark them onboarded and
 * add them to the Resend contact list here. Owners are handled by
 * `completeOnboarding`. Runs once (guarded on `onboarded_at`); never throws.
 */
export async function finishInviteeSignup(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: memberships } = await admin.from("workspace_members").select("role").eq("user_id", userId);
    if (!memberships?.length || memberships.some((m) => m.role === "owner")) return;

    const { data: updated } = await admin
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", userId)
      .is("onboarded_at", null)
      .select("email, full_name");
    const profile = updated?.[0];
    if (profile) await subscribeContact({ email: profile.email, fullName: profile.full_name });
  } catch (error) {
    console.error("[finishInviteeSignup] failed", error instanceof Error ? error.message : error);
  }
}
