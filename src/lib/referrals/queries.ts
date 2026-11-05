import "server-only";

import { firstNameFor } from "@/lib/email/name";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode } from "./code";

export interface ReferralLanding {
  code: string;
  workspaceId: string;
  workspaceName: string;
  inviter: { firstName: string; fullName: string; avatarUrl: string | null };
}

/**
 * What the landing page shows for a code: the inviting workspace and its
 * owner. Null for an unknown, revoked or internal code (the page shows one
 * generic card for all three, so the response never says which).
 */
export async function getReferralLanding(rawCode: string): Promise<ReferralLanding | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("referral_codes")
    .select("code, revoked_at, workspace:workspaces(id, name, kind, owner_id)")
    .eq("code", code)
    .maybeSingle();
  if (!data?.workspace || data.revoked_at || data.workspace.kind !== "customer") return null;
  const { data: owner } = await admin.from("profiles").select("full_name, email, avatar_url").eq("id", data.workspace.owner_id).maybeSingle();
  if (!owner) return null;
  const firstName = firstNameFor(owner.full_name, owner.email);
  return {
    code: data.code,
    workspaceId: data.workspace.id,
    workspaceName: data.workspace.name,
    inviter: { firstName: firstName || data.workspace.name, fullName: owner.full_name?.trim() || data.workspace.name, avatarUrl: owner.avatar_url },
  };
}
