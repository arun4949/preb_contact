import "server-only";

import { getPlan } from "@/lib/credits/plans";
import { sendEmail } from "@/lib/email/resend";
import { CreditsLowEmail } from "@/lib/email/templates/credits-low";
import { log, logError, type Admin } from "@/lib/jobs/shared";

/** Low = under 10 % of the plan. Trials skip this (they get the paused-list email instead). */
export const LOW_CREDIT_RATIO = 0.1;

/**
 * Email the workspace owner once when the balance drops under the threshold.
 * `low_credits_notified_at` is reset by the next grant (Stripe webhook).
 * Never throws — called from settlement.
 */
export async function maybeNotifyLowCredits(admin: Admin, workspaceId: string): Promise<boolean> {
  try {
    const { data: ws } = await admin.from("workspaces").select("id, name, owner_id, plan_key, low_credits_notified_at").eq("id", workspaceId).maybeSingle();
    if (!ws || ws.low_credits_notified_at) return false;
    const plan = getPlan(ws.plan_key);
    if (!plan) return false;
    const { data: available } = await admin.rpc("credits_available", { ws: ws.id });
    const balance = available ?? 0;
    if (balance >= plan.credits * LOW_CREDIT_RATIO) return false;

    // Claim the flag first so concurrent settlements send at most one email.
    const { data: claimed } = await admin
      .from("workspaces")
      .update({ low_credits_notified_at: new Date().toISOString() })
      .eq("id", ws.id)
      .is("low_credits_notified_at", null)
      .select("id");
    if (!claimed?.length) return false;

    const { data: owner } = await admin.from("profiles").select("email").eq("id", ws.owner_id).maybeSingle();
    if (!owner?.email) return false;
    await sendEmail({
      to: owner.email,
      kind: "credits_low",
      workspaceId: ws.id,
      subject: `${ws.name} is running low on credits`,
      react: CreditsLowEmail({ workspaceName: ws.name, available: balance, planCredits: plan.credits }),
    });
    log("billing.low_credits_email", { workspaceId: ws.id, available: balance });
    return true;
  } catch (error) {
    logError("billing.low_credits_failed", error, { workspaceId });
    return false;
  }
}
