"use server";

import { revalidatePath } from "next/cache";
import { isAdminEmail } from "@/lib/auth/work-email";
import { log } from "@/lib/jobs/shared";
import type { Result } from "@/lib/lists/insert-contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { ReferralRejectedReason, ReferralSource, ReferralStatus } from "./constants";

export interface AdminReferral {
  id: string;
  createdAt: string;
  signedUpAt: string;
  expiresAt: string;
  status: ReferralStatus;
  rejectedReason: ReferralRejectedReason | null;
  source: ReferralSource;
  referrer: { workspaceId: string; workspaceName: string; code: string | null };
  /** Full address, admins only; the referrer sees the masked form. */
  referee: { email: string | null; name: string | null; maskedEmail: string; workspaceName: string | null; planKey: string | null };
  stripeInvoiceId: string | null;
  rewardCredits: number | null;
  rewardedAt: string | null;
  revokedAt: string | null;
}

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
  return session;
}

/** Every referral, newest first, including rejected ones (fraud review). */
export async function fetchAllReferrals(): Promise<AdminReferral[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("referrals")
    // Two links each to workspaces and profiles: name the foreign key on every embed.
    .select(
      "id, created_at, signed_up_at, expires_at, status, rejected_reason, source, stripe_invoice_id, reward_credits, rewarded_at, revoked_at, referred_email_masked, code:referral_codes(code), referrer:workspaces!referrals_referrer_workspace_id_fkey(id, name), referred:workspaces!referrals_referred_workspace_id_fkey(name, plan_key), referee:profiles!referrals_referred_user_id_fkey(email, full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    signedUpAt: r.signed_up_at,
    expiresAt: r.expires_at,
    status: r.status as ReferralStatus,
    rejectedReason: (r.rejected_reason as ReferralRejectedReason | null) ?? null,
    source: r.source as ReferralSource,
    referrer: { workspaceId: r.referrer?.id ?? "", workspaceName: r.referrer?.name ?? "Deleted workspace", code: r.code?.code ?? null },
    referee: {
      email: r.referee?.email ?? null,
      name: r.referee?.full_name ?? null,
      maskedEmail: r.referred_email_masked,
      workspaceName: r.referred?.name ?? null,
      planKey: r.referred?.plan_key ?? null,
    },
    stripeInvoiceId: r.stripe_invoice_id,
    rewardCredits: r.reward_credits,
    rewardedAt: r.rewarded_at,
    revokedAt: r.revoked_at,
  }));
}

/** Takes back the unused part of a reward (Terms § 6.4). Returns the credits removed. */
export async function revokeReferralReward(referralId: string): Promise<Result<{ removed: number }>> {
  const session = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(referralId)) return { ok: false, error: "Unknown referral." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("revoke_referral_reward", { p_referral_id: referralId, p_actor: session.userId });
  if (error) return { ok: false, error: error.message };
  log("referral.revoked", { referralId, by: session.userId, removed: data ?? 0 });
  revalidatePath("/admin/referrals");
  return { ok: true, data: { removed: data ?? 0 } };
}
