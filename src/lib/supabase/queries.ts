import "server-only";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type Profile = Tables<"profiles">;
export type Workspace = Tables<"workspaces">;
export type WorkspaceRole = Tables<"workspace_members">["role"];

export interface SessionContext {
  userId: string;
  email: string;
  profile: Profile;
  workspace: Workspace;
  role: WorkspaceRole;
  creditsAvailable: number;
}

/** Authenticated user, or null. Verified against Auth, not just the cookie. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

/** Profile row for the signed-in user (null before the trigger ran or when signed out). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/**
 * Full session context for app pages: profile, current workspace (default or
 * first membership), role and available credits. Null when signed out or the
 * user has no workspace at all.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspace:workspaces(*)")
    .eq("user_id", user.id);

  const rows = (memberships ?? []).filter((m) => m.workspace);
  if (rows.length === 0) return null;

  const current = rows.find((m) => m.workspace!.id === profile.default_workspace_id) ?? rows[0];
  const workspace = current.workspace as Workspace;

  const { data: credits } = await supabase.rpc("credits_available", { ws: workspace.id });

  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    workspace,
    role: current.role,
    creditsAvailable: credits ?? 0,
  };
});
