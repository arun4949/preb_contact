import "server-only";

import type { Admin } from "@/lib/jobs/shared";
import { workspaceSlug } from "@/lib/workspace/naming";

export const INTERNAL_WORKSPACE_NAME = "Preb outreach";

/**
 * The one internal workspace that holds every lead magnet list. Created on
 * first use, owned by the admin who created it (no memberships: every access
 * goes through the service role from /admin/leads and the public page).
 * Internal workspaces are never charged credits (see migration 0022).
 */
export async function ensureInternalWorkspace(admin: Admin, ownerUserId: string): Promise<string> {
  const { data: existing } = await admin.from("workspaces").select("id").eq("kind", "internal").order("created_at").limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await admin
    .from("workspaces")
    .insert({ name: INTERNAL_WORKSPACE_NAME, slug: workspaceSlug(INTERNAL_WORKSPACE_NAME), owner_id: ownerUserId, kind: "internal" })
    .select("id")
    .single();
  if (error || !data) {
    // Lost a race with a parallel create: take the winner.
    const { data: again } = await admin.from("workspaces").select("id").eq("kind", "internal").order("created_at").limit(1).maybeSingle();
    if (again) return again.id;
    throw new Error(`internal workspace insert failed: ${error?.message}`);
  }
  return data.id;
}
