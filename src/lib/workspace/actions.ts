"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext, getWorkspaceMembers, type WorkspaceMember } from "@/lib/supabase/queries";
import { createInviteToken } from "@/lib/auth/invite";
import { isRateLimited, sendEmail } from "@/lib/email/resend";
import { InviteEmail } from "@/lib/email/templates/invite";
import { appOrigin } from "@/lib/jobs/shared";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type InviteRole = "admin" | "member";
export type MemberRole = "owner" | InviteRole;

export interface PendingInvite {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
}

export interface MembersOverview {
  members: WorkspaceMember[];
  invites: PendingInvite[];
  me: string;
  myRole: MemberRole;
  canManage: boolean;
  workspaceName: string;
}

/** Max pending invites a workspace may send per hour (plan § Security). */
const WORKSPACE_INVITES_PER_HOUR = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireSession() {
  const session = await getSessionContext();
  if (!session) throw new Error("Not signed in");
  return session;
}

/** Members + pending invites for Settings › Members. Invites are admin-only through RLS. */
export async function fetchMembers(): Promise<MembersOverview> {
  const session = await requireSession();
  const supabase = await createClient();
  const canManage = session.role !== "member";
  const [members, invitesRes] = await Promise.all([
    getWorkspaceMembers(session.workspace.id),
    canManage
      ? supabase
          .from("workspace_invites")
          .select("id, email, role, expires_at, created_at")
          .eq("workspace_id", session.workspace.id)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const now = Date.now();
  const order: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 };
  return {
    members: [...members].sort((a, b) => order[a.role] - order[b.role] || (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email)),
    invites: (invitesRes.data ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role === "admin" ? "admin" : "member",
      expiresAt: i.expires_at,
      createdAt: i.created_at,
      expired: new Date(i.expires_at).getTime() < now,
    })),
    me: session.userId,
    myRole: session.role,
    canManage,
    workspaceName: session.workspace.name,
  };
}

async function deliverInvite(params: { inviteId: string; email: string; role: InviteRole; workspaceId: string; workspaceName: string; inviterName: string }) {
  const admin = createAdminClient();
  const { token, tokenHash } = createInviteToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // A fresh token on every (re)send: the previous link stops working.
  const { error } = await admin.from("workspace_invites").update({ token_hash: tokenHash, expires_at: expiresAt }).eq("id", params.inviteId);
  if (error) throw new Error("Could not prepare the invite link.");
  await sendEmail({
    to: params.email,
    kind: "invite",
    workspaceId: params.workspaceId,
    subject: `${params.inviterName} invited you to ${params.workspaceName} on Preb`,
    react: InviteEmail({ url: `${appOrigin()}/invite/${token}`, inviterName: params.inviterName, workspaceName: params.workspaceName, role: params.role }),
  });
}

async function workspaceInviteBudgetExceeded(workspaceId: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_sends")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("kind", "invite")
    .gte("sent_at", since);
  return (count ?? 0) >= WORKSPACE_INVITES_PER_HOUR;
}

/** Owners/admins invite by email. An existing pending invite for the address is re-issued. */
export async function inviteMember(emailInput: string, role: InviteRole): Promise<Result> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can invite teammates." };
  const email = emailInput.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (role !== "admin" && role !== "member") return { ok: false, error: "Choose a role." };
  if (email === session.email.toLowerCase()) return { ok: false, error: "That's your own address." };

  const members = await getWorkspaceMembers(session.workspace.id);
  if (members.some((m) => m.email.toLowerCase() === email)) return { ok: false, error: "That person is already a member of this workspace." };

  if (await workspaceInviteBudgetExceeded(session.workspace.id)) return { ok: false, error: "Invite limit reached — try again in an hour." };
  if (await isRateLimited(email, "invite")) return { ok: false, error: "That address was invited too many times recently." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("workspace_invites")
    .select("id")
    .eq("workspace_id", session.workspace.id)
    .ilike("email", email)
    .is("accepted_at", null)
    .maybeSingle();

  let inviteId = existing?.id ?? null;
  if (inviteId) {
    // Role may change on re-invite; the token is replaced by deliverInvite.
    const admin = createAdminClient();
    await admin.from("workspace_invites").update({ role, invited_by: session.userId }).eq("id", inviteId);
  } else {
    const { tokenHash } = createInviteToken(); // placeholder, replaced before sending
    const { data, error } = await supabase
      .from("workspace_invites")
      .insert({ workspace_id: session.workspace.id, email, role, token_hash: tokenHash, invited_by: session.userId })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: "Could not create the invite." };
    inviteId = data.id;
  }

  try {
    await deliverInvite({
      inviteId,
      email,
      role,
      workspaceId: session.workspace.id,
      workspaceName: session.workspace.name,
      inviterName: session.profile.full_name ?? session.email,
    });
  } catch (error) {
    console.error("[inviteMember] send failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "The invite was saved but the email could not be sent. Use Resend to try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Re-send a pending invite with a fresh 7-day link. */
export async function resendInvite(inviteId: string): Promise<Result> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can manage invites." };
  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("id, email, role, accepted_at")
    .eq("id", inviteId)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (!invite || invite.accepted_at) return { ok: false, error: "That invite no longer exists." };
  if (await workspaceInviteBudgetExceeded(session.workspace.id)) return { ok: false, error: "Invite limit reached — try again in an hour." };
  if (await isRateLimited(invite.email, "invite")) return { ok: false, error: "That address was invited too many times recently." };
  try {
    await deliverInvite({
      inviteId: invite.id,
      email: invite.email,
      role: invite.role === "admin" ? "admin" : "member",
      workspaceId: session.workspace.id,
      workspaceName: session.workspace.name,
      inviterName: session.profile.full_name ?? session.email,
    });
  } catch (error) {
    console.error("[resendInvite] send failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "The email could not be sent. Please try again." };
  }
  return { ok: true, data: undefined };
}

export async function revokeInvite(inviteId: string): Promise<Result> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can manage invites." };
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_invites").delete().eq("id", inviteId).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: "Could not revoke the invite." };
  return { ok: true, data: undefined };
}

/** Owners/admins change admin ↔ member. The owner's role is fixed (RLS enforces it too). */
export async function changeMemberRole(userId: string, role: InviteRole): Promise<Result> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can change roles." };
  if (role !== "admin" && role !== "member") return { ok: false, error: "Choose a role." };
  if (userId === session.userId) return { ok: false, error: "You can't change your own role." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", session.workspace.id)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select("user_id");
  if (error || !data?.length) return { ok: false, error: "Could not change the role." };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Remove a teammate (owners/admins), or leave the workspace yourself. Owners can't be removed. */
export async function removeMember(userId: string): Promise<Result<{ left: boolean }>> {
  const session = await requireSession();
  const self = userId === session.userId;
  if (!self && session.role === "member") return { ok: false, error: "Only owners and admins can remove members." };
  if (self && session.role === "owner") return { ok: false, error: "The owner can't leave the workspace." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", session.workspace.id)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select("user_id");
  if (error || !data?.length) return { ok: false, error: "Could not remove that member." };

  // A removed user whose default workspace was this one falls back to another membership.
  const admin = createAdminClient();
  const { data: other } = await admin.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
  await admin
    .from("profiles")
    .update({ default_workspace_id: other?.workspace_id ?? null })
    .eq("id", userId)
    .eq("default_workspace_id", session.workspace.id);

  revalidatePath("/", "layout");
  return { ok: true, data: { left: self } };
}
