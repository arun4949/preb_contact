import "server-only";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { getPlan } from "@/lib/credits/plans";

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

  // Both only need the user id: one round trip instead of two.
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("workspace_members").select("role, workspace:workspaces(*)").eq("user_id", user.id),
  ]);
  if (!profile) return null;

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

/* ------------------------------------------------------------------ lists */

export type ListRow = Tables<"lists">;
export type ListStatus = ListRow["status"];

export interface ListFilters {
  status?: "all" | "enriching" | "completed" | "paused";
  owner?: string; // "all" | "me" | user id
  q?: string;
}

const STATUS_GROUPS: Record<Exclude<NonNullable<ListFilters["status"]>, "all">, ListStatus[]> = {
  enriching: ["queued", "enriching", "stopping"],
  completed: ["completed", "stopped"],
  paused: ["paused_credits", "paused_upstream", "failed"],
};

export interface WorkspaceMember {
  userId: string;
  role: WorkspaceRole;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
}

/** Members of the current workspace with their profile (for owner filters, settings). */
export const getWorkspaceMembers = cache(async (workspaceId: string): Promise<WorkspaceMember[]> => {
  const supabase = await createClient();
  const { data: members } = await supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId);
  const ids = (members ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return (members ?? []).map((m) => {
    const p = byId.get(m.user_id);
    return { userId: m.user_id, role: m.role, fullName: p?.full_name ?? null, email: p?.email ?? "", avatarUrl: p?.avatar_url ?? null };
  });
});

/** Lists of a workspace (newest first), optionally filtered. Drafts are hidden. */
export async function getLists(workspaceId: string, userId: string, filters: ListFilters = {}): Promise<ListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("lists")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("status", "draft")
    // Manual runs (Enrich tab) are not shown as lists.
    .eq("source", "csv")
    .order("created_at", { ascending: false });
  if (filters.status && filters.status !== "all") query = query.in("status", STATUS_GROUPS[filters.status]);
  if (filters.owner === "me") query = query.eq("created_by", userId);
  else if (filters.owner && filters.owner !== "all") query = query.eq("created_by", filters.owner);
  if (filters.q?.trim()) query = query.ilike("name", `%${filters.q.trim().replace(/[%_]/g, "\\$&")}%`);
  const { data } = await query;
  return data ?? [];
}

export interface CreditSummary {
  available: number;
  /** Credits in the current plan period (plan size, or the trial grant). */
  planCredits: number;
  /** Earliest upcoming expiry among grants with remaining credits. */
  nextExpiry: { amount: number; at: string } | null;
  isTrial: boolean;
}

/** Balance + next expiry for the credits dropdown. `available` comes from the session context (same request, no second RPC). */
export const getCreditSummary = cache(async (workspace: Workspace, available: number): Promise<CreditSummary> => {
  const supabase = await createClient();
  const { data: grants } = await supabase
    .from("credit_grants")
    .select("remaining, expires_at, source, amount")
    .eq("workspace_id", workspace.id)
    .gt("remaining", 0)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: true });
  const rows = grants ?? [];
  const isTrial = !workspace.plan_key;
  // Denominator is the plan's per-period amount, not the sum of live grants:
  // monthly grants overlap for 3 months, which would inflate it.
  const planCredits = isTrial ? (rows.find((g) => g.source === "trial")?.amount ?? 50) : (getPlan(workspace.plan_key)?.credits ?? 0);
  const next = rows[0];
  return {
    available,
    planCredits: Math.max(planCredits, available),
    nextExpiry: next ? { amount: next.remaining, at: next.expires_at } : null,
    isTrial,
  };
});
