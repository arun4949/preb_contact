"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/queries";
import { hashInviteToken } from "@/lib/auth/invite";

/** Accept a pending invite for the signed-in user (email must match). Single use. */
export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const user = await getUser();
  if (!user || !token) redirect("/login");

  const admin = createAdminClient();
  const tokenHash = hashInviteToken(token);
  const { data: invite } = await admin
    .from("workspace_invites")
    .select("id, workspace_id, email, role, expires_at, accepted_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) redirect(`/invite/${token}`);
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) redirect(`/invite/${token}`);

  await admin.from("workspace_members").upsert(
    { workspace_id: invite.workspace_id, user_id: user.id, role: invite.role },
    { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
  );
  await admin.from("workspace_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);
  await admin
    .from("profiles")
    .update({ default_workspace_id: invite.workspace_id, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/lists");
}
