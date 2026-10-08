import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { workspaceSlug } from "@/lib/workspace/naming";

/**
 * Create an owned workspace for a signed-in user who has none (e.g. a member
 * removed from their only workspace). Mirrors the signup trigger minus the
 * trial: trials are granted once, at signup, so a removed invitee can't start
 * farming credits through this path. Returns the workspace id, or null when
 * the user already belongs to a workspace (guards double submits).
 */
export async function createOwnWorkspace(userId: string, name: string): Promise<string | null> {
  const admin = createAdminClient();

  const { count } = await admin
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count) return null;

  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name, slug: workspaceSlug(name), owner_id: userId })
    .select("id")
    .single();
  if (wsError || !workspace) throw new Error(`workspace insert failed: ${wsError?.message}`);

  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: userId, role: "owner" });
  if (memberError) {
    await admin.from("workspaces").delete().eq("id", workspace.id);
    throw new Error(`membership insert failed: ${memberError.message}`);
  }

  await admin.from("profiles").update({ default_workspace_id: workspace.id }).eq("id", userId);
  return workspace.id;
}
