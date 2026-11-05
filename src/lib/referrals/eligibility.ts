import { emailDomain, isFreeEmailDomain } from "@/lib/auth/work-email";
import type { ReferralRejectedReason } from "./constants";

/**
 * Whether a new account may be recorded as a referral of a code. Pure, so the
 * rules are unit-tested; `attributeReferralSignup` gathers the facts. A
 * rejected signup is still stored (with the reason) for fraud review, but it
 * can never earn a reward.
 */

/** Only an account created this recently counts; an old customer who clicks a link is not a referral. */
export const FRESH_ACCOUNT_MS = 60 * 60_000;

export interface AttributionInput {
  refereeEmail: string;
  refereeCreatedAt: string | Date;
  /** The workspace the referee owns (signup trigger), or null for an invitee. */
  refereeOwnedWorkspaceId: string | null;
  /** Every workspace the referee is a member of. */
  refereeMemberWorkspaceIds: readonly string[];
  referrerWorkspaceId: string;
  referrerWorkspaceKind: string;
  referrerOwnerEmail: string;
  codeRevokedAt: string | null;
  /** The referee's email (or Google identity) belongs to an account deleted in the last 12 months. */
  tombstoned: boolean;
  now?: number;
}

export type AttributionDecision = { ok: true } | { ok: false; reason: ReferralRejectedReason };

export function decideAttribution(input: AttributionInput): AttributionDecision {
  const now = input.now ?? Date.now();
  const referee = input.refereeEmail.trim().toLowerCase();
  const referrer = input.referrerOwnerEmail.trim().toLowerCase();

  if (input.codeRevokedAt) return { ok: false, reason: "code_revoked" };
  if (input.referrerWorkspaceKind !== "customer") return { ok: false, reason: "referrer_internal" };
  if (now - new Date(input.refereeCreatedAt).getTime() > FRESH_ACCOUNT_MS) return { ok: false, reason: "stale_account" };
  if (!input.refereeOwnedWorkspaceId) return { ok: false, reason: "not_owner" };
  if (input.refereeOwnedWorkspaceId === input.referrerWorkspaceId || input.refereeMemberWorkspaceIds.includes(input.referrerWorkspaceId)) {
    return { ok: false, reason: "same_workspace" };
  }
  if (referee === referrer) return { ok: false, reason: "self_referral" };
  // Colleagues share a domain and belong in the same workspace as members; a
  // second account on the referrer's own domain is the classic self-referral.
  // Free-mail domains are shared by strangers, so only the full address counts there.
  if (!isFreeEmailDomain(referee) && emailDomain(referee) === emailDomain(referrer)) return { ok: false, reason: "same_domain" };
  if (input.tombstoned) return { ok: false, reason: "recreated_account" };
  return { ok: true };
}
