"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import { generateReferralCode } from "./code";
import { rewardCredits, windowDays } from "./config";
import { REFERRAL_REWARD_EXPIRY_MONTHS, REFERRAL_TRIAL_CREDITS, referralPath, type ReferralStatus } from "./constants";

/* ------------------------------------------------------------------ types */

export interface ReferralEntry {
  id: string;
  /** "j***@acme.com" */
  maskedEmail: string;
  signedUpAt: string;
  expiresAt: string;
  status: Exclude<ReferralStatus, "rejected">;
  rewardedAt: string | null;
  rewardCredits: number | null;
}

export interface ReferralOverview {
  /** Null for the internal workspace, which cannot refer. */
  code: string | null;
  /** Public path (without origin); the client builds the URL from `window.location.origin`. */
  path: string | null;
  rewardCredits: number;
  windowDays: number;
  expiryMonths: number;
  trialCredits: number;
  stats: { clicks: number; signups: number; rewarded: number; creditsEarned: number };
  referrals: ReferralEntry[];
  /** Workspace name, for the share text. */
  workspaceName: string;
  /** The sharer's first name, for the share text. */
  firstName: string;
}

/* ---------------------------------------------------------------- helpers */

async function requireSession() {
  const session = await getSessionContext();
  if (!session) throw new Error("Not signed in");
  return session;
}

/** The workspace's code, created on first use. A collision on the unique code just retries. */
async function ensureCode(workspaceId: string, userId: string): Promise<{ code: string; clickCount: number }> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("referral_codes").select("code, click_count").eq("workspace_id", workspaceId).maybeSingle();
  if (existing) return { code: existing.code, clickCount: existing.click_count };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await admin
      .from("referral_codes")
      .insert({ workspace_id: workspaceId, code: generateReferralCode(), created_by: userId })
      .select("code, click_count")
      .maybeSingle();
    if (data) return { code: data.code, clickCount: data.click_count };
    if (error?.code === "23505") {
      // Either the code collided (retry) or a teammate created the row meanwhile (read it).
      const { data: raced } = await admin.from("referral_codes").select("code, click_count").eq("workspace_id", workspaceId).maybeSingle();
      if (raced) return { code: raced.code, clickCount: raced.click_count };
      continue;
    }
    throw new Error(error?.message ?? "Could not create the referral code");
  }
  throw new Error("Could not create the referral code");
}

/* ---------------------------------------------------------------- actions */

/** Everything the Invite friends settings page shows. Any member of the workspace may share the link. */
export async function fetchReferralOverview(): Promise<ReferralOverview> {
  const session = await requireSession();
  const base = {
    rewardCredits: rewardCredits(),
    windowDays: windowDays(),
    expiryMonths: REFERRAL_REWARD_EXPIRY_MONTHS,
    trialCredits: REFERRAL_TRIAL_CREDITS,
    workspaceName: session.workspace.name,
    firstName: (session.profile.full_name ?? "").trim().split(/\s+/)[0] ?? "",
  };
  if (session.workspace.kind !== "customer") {
    return { ...base, code: null, path: null, stats: { clicks: 0, signups: 0, rewarded: 0, creditsEarned: 0 }, referrals: [] };
  }
  const { code, clickCount } = await ensureCode(session.workspace.id, session.userId);
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("referrals")
    .select("id, referred_email_masked, signed_up_at, expires_at, status, rewarded_at, reward_credits")
    .eq("referrer_workspace_id", session.workspace.id)
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const referrals: ReferralEntry[] = (rows ?? []).map((r) => ({
    id: r.id,
    maskedEmail: r.referred_email_masked,
    signedUpAt: r.signed_up_at,
    expiresAt: r.expires_at,
    status: r.status as ReferralEntry["status"],
    rewardedAt: r.rewarded_at,
    rewardCredits: r.reward_credits,
  }));
  return {
    ...base,
    code,
    path: referralPath(code),
    stats: {
      clicks: clickCount,
      signups: referrals.length,
      rewarded: referrals.filter((r) => r.status === "rewarded").length,
      creditsEarned: referrals.reduce((n, r) => n + (r.status === "rewarded" ? (r.rewardCredits ?? 0) : 0), 0),
    },
    referrals,
  };
}
