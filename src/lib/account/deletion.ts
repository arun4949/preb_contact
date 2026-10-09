import "server-only";

import { createHash } from "node:crypto";
import type { Tables } from "@/lib/supabase/types";
import { log, logError, type Admin } from "@/lib/jobs/shared";
import { stripe } from "@/lib/stripe/client";
import { removeContact } from "@/lib/email/contacts";
import { workspaceDeletedCopy } from "@/lib/notifications/copy";
import { notifyUsers } from "@/lib/notifications/emit";

/**
 * Self-service deletion (privacy policy § 11). Everything here runs with the
 * service role; callers verify the actor first. Order matters because of the
 * `on delete restrict` foreign keys: a user can only be removed from Auth once
 * they own no workspace and created no list in a workspace that survives.
 */

const BUCKET = "list-uploads";
type Workspace = Tables<"workspaces">;

/** A deletion the product refuses with a message the user can act on. */
export class DeletionBlockedError extends Error {}

/** sha256 of the lower-cased address: the tombstone never stores the email itself. */
export function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

/** Stop everything that is still running so no provider batch lands on a deleted list. */
async function stopWorkspaceLists(admin: Admin, workspaceId: string): Promise<void> {
  const { data: lists } = await admin
    .from("lists")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("status", ["queued", "enriching", "paused_credits", "paused_upstream", "stopping"]);
  const ids = (lists ?? []).map((l) => l.id);
  if (ids.length === 0) return;
  await admin.from("list_contacts").update({ status: "skipped", skip_reason: "stopped" }).in("list_id", ids).eq("status", "pending");
  await admin.from("lists").update({ status: "stopped" }).in("id", ids);
}

/**
 * Immediate cancellation, no proration refund (used credits are not refunded,
 * see Terms). `resource_missing` is ignored: dev and prod share one database,
 * so an id may belong to the other Stripe mode.
 */
async function cancelStripe(workspace: Pick<Workspace, "id" | "stripe_subscription_id" | "stripe_customer_id">): Promise<void> {
  const ignoreMissing = (error: unknown) => {
    if ((error as { code?: string }).code === "resource_missing") return;
    throw error;
  };
  if (workspace.stripe_subscription_id) {
    try {
      await stripe().subscriptions.cancel(workspace.stripe_subscription_id, { invoice_now: false, prorate: false });
    } catch (error) {
      ignoreMissing(error);
    }
  }
  if (workspace.stripe_customer_id) {
    // Invoices stay in Stripe for tax law (privacy policy § 8); the customer object itself goes.
    try {
      await stripe().customers.del(workspace.stripe_customer_id);
    } catch (error) {
      ignoreMissing(error);
    }
  }
}

/** Storage `list()` is not recursive: walk `${wsId}/${listId}/…` and remove every object. */
async function removeWorkspaceFiles(admin: Admin, workspaceId: string): Promise<void> {
  const { data: folders } = await admin.storage.from(BUCKET).list(workspaceId, { limit: 1000 });
  const paths: string[] = [];
  for (const folder of folders ?? []) {
    const prefix = `${workspaceId}/${folder.name}`;
    const { data: objects } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
    for (const o of objects ?? []) paths.push(`${prefix}/${o.name}`);
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(`storage: ${error.message}`);
  }
}

/**
 * Deletes a workspace and everything in it. The row delete cascades to
 * members, invites, lists, contacts, batches, credits, cache rows and
 * workspace notifications. Remaining members are told in-app (with no
 * workspace id, so the note survives the cascade).
 */
export async function deleteWorkspaceData(admin: Admin, workspace: Workspace, actorUserId: string | null): Promise<void> {
  await stopWorkspaceLists(admin, workspace.id);
  await cancelStripe(workspace);
  await removeWorkspaceFiles(admin, workspace.id);

  const { data: members } = await admin.from("workspace_members").select("user_id").eq("workspace_id", workspace.id);
  const memberIds = (members ?? []).map((m) => m.user_id);

  const { error } = await admin.from("workspaces").delete().eq("id", workspace.id);
  if (error) throw new Error(`workspace delete: ${error.message}`);

  // Members whose default workspace this was fall back to another membership.
  for (const userId of memberIds) {
    const { data: other } = await admin.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle();
    await admin.from("profiles").update({ default_workspace_id: other?.workspace_id ?? null }).eq("id", userId).is("default_workspace_id", null);
  }
  const others = memberIds.filter((id) => id !== actorUserId);
  if (others.length) await notifyUsers(admin, others, workspaceDeletedCopy(workspace.name));
  log("account.workspace_deleted", { workspaceId: workspace.id, members: memberIds.length });
}

/**
 * Removes a user entirely: owned workspaces (with their data), memberships
 * elsewhere (their lists pass to that workspace's owner), the Auth user, the
 * Resend contact and the email log. Leaves a hashed tombstone so the
 * one-trial-per-person rule survives for 12 months.
 */
export async function deleteUserCompletely(admin: Admin, userId: string): Promise<void> {
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser.user) throw new Error(`auth user: ${authErr?.message ?? "not found"}`);
  const email = (authUser.user.email ?? "").toLowerCase();
  const google = authUser.user.identities?.find((i) => i.provider === "google")?.identity_data;
  const googleId = (google?.provider_id ?? google?.sub) as string | undefined;

  const { count: announcements } = await admin.from("admin_notifications").select("id", { count: "exact", head: true }).eq("created_by", userId);
  if (announcements) {
    throw new DeletionBlockedError("This account has sent team announcements and must be removed by another founder. Email hello@preb.co.");
  }

  const { data: owned } = await admin.from("workspaces").select("*").eq("owner_id", userId);
  for (const ws of owned ?? []) await deleteWorkspaceData(admin, ws, userId);

  const { data: memberships } = await admin.from("workspace_members").select("workspace_id, workspaces!inner(owner_id)").eq("user_id", userId);
  for (const m of memberships ?? []) {
    const ownerId = (m.workspaces as unknown as { owner_id: string }).owner_id;
    await admin.from("lists").update({ created_by: ownerId }).eq("workspace_id", m.workspace_id).eq("created_by", userId);
    await admin.from("workspace_members").delete().eq("workspace_id", m.workspace_id).eq("user_id", userId);
  }

  if (email) {
    await admin
      .from("deleted_accounts")
      .upsert({ email_hash: emailHash(email), google_provider_id: googleId ?? null, deleted_at: new Date().toISOString() }, { onConflict: "email_hash" });
    await removeContact(email);
    await admin.from("email_sends").delete().ilike("email", email);
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    logError("account.delete_user_failed", error, { userId });
    throw new Error(`auth delete: ${error.message}`);
  }
  log("account.user_deleted", { userId });
}
