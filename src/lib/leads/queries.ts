import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ListRow } from "@/lib/supabase/queries";
import type { Tables } from "@/lib/supabase/types";
import { hashShareToken, looksLikeShareToken } from "./token";
import { leadOwnerView, type LeadOwnerView } from "./owners";

export type LeadShareRow = Tables<"lead_shares">;

export interface LeadShare {
  share: LeadShareRow;
  list: ListRow;
  owner: LeadOwnerView;
}

/** A share by its URL token (service role; the caller enforces the code or the admin session). */
export async function getShareByToken(token: string): Promise<LeadShare | null> {
  if (!looksLikeShareToken(token)) return null;
  const admin = createAdminClient();
  const { data: share } = await admin.from("lead_shares").select("*").eq("token_hash", hashShareToken(token)).maybeSingle();
  if (!share) return null;
  const [{ data: list }, { data: owner }] = await Promise.all([
    admin.from("lists").select("*").eq("id", share.list_id).maybeSingle(),
    admin.from("profiles").select("full_name, email, avatar_url").eq("id", share.owner_id).maybeSingle(),
  ]);
  if (!list || !owner) return null;
  return { share, list, owner: leadOwnerView(owner) };
}
