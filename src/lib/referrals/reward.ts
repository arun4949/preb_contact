import "server-only";

import type Stripe from "stripe";
import { sendEmail } from "@/lib/email/resend";
import { firstNameFor } from "@/lib/email/name";
import { ReferralRewardedEmail } from "@/lib/email/templates/referral-rewarded";
import { log, logError, type Admin } from "@/lib/jobs/shared";
import { referralRewardedCopy } from "@/lib/notifications/copy";
import { notifyWorkspace } from "@/lib/notifications/emit";
import { invoiceSubscriptionId, isOverspendInvoice } from "@/lib/stripe/webhooks";
import { monthlyCap, rewardCredits } from "./config";
import { REFERRAL_REWARD_EXPIRY_MONTHS } from "./constants";

/**
 * Only money counts: a subscription invoice (not an overspend invoice) with
 * an amount actually paid. A 100 % promotion code pays nothing and earns the
 * referrer nothing.
 */
export function shouldAttemptReward(invoice: Pick<Stripe.Invoice, "metadata" | "parent" | "amount_paid">): boolean {
  return !isOverspendInvoice(invoice) && invoiceSubscriptionId(invoice as Stripe.Invoice) !== null && invoice.amount_paid > 0;
}

/** Twelve months from now, end of day, like the plan grants. */
export function rewardExpiry(from = new Date()): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + REFERRAL_REWARD_EXPIRY_MONTHS);
  return d;
}

export type RewardOutcome = "none" | "already_rewarded" | "expired" | "ineligible" | "cap_reached" | "rewarded";

/**
 * Rewards the referrer of `refereeWorkspaceId` for this paid invoice, once.
 * The SQL function owns the locking and the state machine; this side only
 * reads the configuration and tells the referrer. Throws on a database error
 * so the webhook returns 500 and Stripe retries (the function is idempotent).
 */
export async function rewardReferral(admin: Admin, refereeWorkspaceId: string, invoice: Pick<Stripe.Invoice, "id">): Promise<RewardOutcome> {
  // Most invoices have no referral behind them: one indexed read before the RPC.
  const { data: pending } = await admin.from("referrals").select("id").eq("referred_workspace_id", refereeWorkspaceId).eq("status", "pending").limit(1).maybeSingle();
  if (!pending) return "none";

  const credits = rewardCredits();
  const expiresAt = rewardExpiry();
  const { data, error } = await admin.rpc("reward_referral", {
    p_referred_workspace_id: refereeWorkspaceId,
    p_stripe_invoice_id: invoice.id,
    p_amount: credits,
    p_expires_at: expiresAt.toISOString(),
    p_monthly_cap: monthlyCap(),
  });
  if (error) throw new Error(`reward_referral failed: ${error.message}`);
  const row = data?.[0];
  const outcome = (row?.outcome ?? "none") as RewardOutcome;
  if (outcome !== "rewarded") {
    if (outcome === "cap_reached") log("referral.cap_reached", { referralId: row?.referral_id, referrerWorkspaceId: row?.referrer_workspace_id, invoiceId: invoice.id });
    else log("referral.not_rewarded", { outcome, referralId: row?.referral_id, invoiceId: invoice.id });
    return outcome;
  }

  const referrerWorkspaceId = row!.referrer_workspace_id!;
  log("referral.rewarded", { referralId: row!.referral_id, referrerWorkspaceId, refereeWorkspaceId, invoiceId: invoice.id, credits, grantId: row!.grant_id });
  await admin.from("workspaces").update({ low_credits_notified_at: null }).eq("id", referrerWorkspaceId);
  await notifyWorkspace(admin, referrerWorkspaceId, referralRewardedCopy({ credits, expiresAt }), {
    roles: ["owner", "admin"],
    dedupeKey: `referral_rewarded:${row!.referral_id}`,
  });
  await emailReferrer(admin, referrerWorkspaceId, row!.referral_id!, credits, expiresAt);
  return outcome;
}

/** The owner gets a mail; a failed send is logged, never thrown (the reward is already booked). */
async function emailReferrer(admin: Admin, workspaceId: string, referralId: string, credits: number, expiresAt: Date): Promise<void> {
  try {
    const [{ data: ws }, { data: referral }] = await Promise.all([
      admin.from("workspaces").select("owner_id, name").eq("id", workspaceId).maybeSingle(),
      admin.from("referrals").select("referred_email_masked").eq("id", referralId).maybeSingle(),
    ]);
    const { data: owner } = ws ? await admin.from("profiles").select("email, full_name").eq("id", ws.owner_id).maybeSingle() : { data: null };
    if (!owner || !ws || !referral) return;
    await sendEmail({
      to: owner.email,
      kind: "referral_rewarded",
      workspaceId,
      subject: `You earned ${credits.toLocaleString("en-US")} credits on Preb`,
      react: ReferralRewardedEmail({
        firstName: firstNameFor(owner.full_name, owner.email),
        credits,
        maskedEmail: referral.referred_email_masked,
        workspaceName: ws.name,
        expiresAt: expiresAt.toISOString(),
      }),
    });
  } catch (error) {
    logError("referral.email_failed", error, { workspaceId, referralId });
  }
}
