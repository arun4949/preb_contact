import "server-only";

import { cookies } from "next/headers";
import { emailHash } from "@/lib/account/deletion";
import { log, logError, type Admin } from "@/lib/jobs/shared";
import { maskEmail, normalizeCode } from "./code";
import { windowDays } from "./config";
import { REFERRAL_COOKIE, type ReferralSource } from "./constants";
import { decideAttribution } from "./eligibility";

/** Tombstones of deleted accounts block a reward for this long (same window as the trial guard). */
const TOMBSTONE_MONTHS = 12;

/**
 * Records a brand-new account as a referral of `rawCode`. Called from the
 * magic-link request (the device that holds the cookie), the Google callback
 * and onboarding; the unique constraints make the three calls idempotent.
 * Everything is decided server-side from the cookie, never from user
 * metadata. Never throws: a failed attribution must not break a signup.
 */
export async function attributeReferralSignup(admin: Admin, userId: string, rawCode: string | null | undefined, source: ReferralSource): Promise<void> {
  const code = normalizeCode(rawCode);
  if (!code) return;
  try {
    const { data: ref } = await admin
      .from("referral_codes")
      .select("id, revoked_at, workspace_id, workspace:workspaces(kind, owner_id)")
      .eq("code", code)
      .maybeSingle();
    if (!ref?.workspace) return;

    const [{ data: referee }, { data: memberships }, { data: referrerOwner }] = await Promise.all([
      admin.from("profiles").select("email, created_at").eq("id", userId).maybeSingle(),
      admin.from("workspace_members").select("workspace_id, role").eq("user_id", userId),
      admin.from("profiles").select("email").eq("id", ref.workspace.owner_id).maybeSingle(),
    ]);
    if (!referee || !referrerOwner) return;

    const hash = emailHash(referee.email);
    const { data: tombstone } = await admin
      .from("deleted_accounts")
      .select("email_hash")
      .eq("email_hash", hash)
      .gt("deleted_at", new Date(Date.now() - TOMBSTONE_MONTHS * 30 * 86_400_000).toISOString())
      .limit(1)
      .maybeSingle();

    const owned = (memberships ?? []).find((m) => m.role === "owner")?.workspace_id ?? null;
    const decision = decideAttribution({
      refereeEmail: referee.email,
      refereeCreatedAt: referee.created_at,
      refereeOwnedWorkspaceId: owned,
      refereeMemberWorkspaceIds: (memberships ?? []).map((m) => m.workspace_id),
      referrerWorkspaceId: ref.workspace_id,
      referrerWorkspaceKind: ref.workspace.kind,
      referrerOwnerEmail: referrerOwner.email,
      codeRevokedAt: ref.revoked_at,
      tombstoned: Boolean(tombstone),
    });

    const signedUpAt = new Date(referee.created_at);
    const { error } = await admin.from("referrals").insert({
      code_id: ref.id,
      referrer_workspace_id: ref.workspace_id,
      referred_user_id: userId,
      referred_workspace_id: owned,
      referred_email_hash: hash,
      referred_email_masked: maskEmail(referee.email),
      source,
      status: decision.ok ? "pending" : "rejected",
      rejected_reason: decision.ok ? null : decision.reason,
      signed_up_at: signedUpAt.toISOString(),
      expires_at: new Date(signedUpAt.getTime() + windowDays() * 86_400_000).toISOString(),
    });
    if (error) {
      // 23505: this person is already recorded (an earlier entry point, or a deleted account that came back).
      if (error.code !== "23505") throw new Error(error.message);
      return;
    }
    if (decision.ok) log("referral.attributed", { userId, referrerWorkspaceId: ref.workspace_id, source });
    else log("referral.rejected", { userId, referrerWorkspaceId: ref.workspace_id, source, reason: decision.reason });
  } catch (error) {
    logError("referral.attribution_failed", error, { userId, source });
  }
}

/** The code from the attribution cookie of the current request, if any. */
export async function readReferralCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(REFERRAL_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function clearReferralCookie(): Promise<void> {
  try {
    (await cookies()).delete(REFERRAL_COOKIE);
  } catch {
    // Read-only context (a render): the cookie expires on its own.
  }
}
