"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { getSessionContext } from "@/lib/supabase/queries";
import { appOrigin } from "@/lib/jobs/shared";
import { getCatalogue, getCataloguePlan, type CataloguePlan } from "@/lib/stripe/catalogue";
import { createCheckoutSession, ensureCustomer } from "@/lib/stripe/checkout";
import { createPortalSession } from "@/lib/stripe/portal";
import { activeSubscriptionId, applySwitch, previewSwitch, type SwitchPreview } from "@/lib/stripe/subscription";
import { getBillingOverview, getOverspendOverview, getOverspendStart, type BillingOverview, type OverspendOverview, type OverspendStart } from "./queries";
import { overspendEligibility, paymentMethodSummary, retryOverspendPayment, type PaymentMethodSummary } from "./overspend";
import { createAdminClient } from "@/lib/supabase/admin";
import { readMetaRequestContext, sendMetaEvent } from "@/lib/meta/capi";
import { isMetaEventId } from "@/lib/meta/client";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireSession() {
  const session = await getSessionContext();
  if (!session) throw new Error("Not signed in");
  return session;
}

const BILLING_RETURN = () => `${appOrigin()}/lists?settings=billing`;

export async function fetchBillingOverview(): Promise<BillingOverview> {
  return getBillingOverview(await requireSession());
}

export interface PlanCatalogue {
  plans: CataloguePlan[];
  currentPlanKey: string | null;
  hasSubscription: boolean;
  canManage: boolean;
}

/** Plans with live Stripe prices for the plan picker. */
export async function fetchPlanCatalogue(): Promise<Result<PlanCatalogue>> {
  const session = await requireSession();
  try {
    const [plans, subscriptionId] = await Promise.all([getCatalogue(), activeSubscriptionId(session.workspace)]);
    return {
      ok: true,
      data: {
        plans,
        currentPlanKey: subscriptionId ? session.workspace.plan_key : null,
        hasSubscription: Boolean(subscriptionId),
        canManage: session.role !== "member",
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load plans." };
  }
}

/** New subscribers: Stripe Checkout. Existing subscribers use `previewPlanSwitch` + `confirmPlanSwitch`. */
export async function startCheckout(planKey: string, metaEventId?: string): Promise<Result<never>> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can change the plan." };
  const plan = await getCataloguePlan(planKey);
  if (!plan) return { ok: false, error: "That plan is not available." };
  const ws = session.workspace;

  let url: string | null = null;
  try {
    if (await activeSubscriptionId(ws)) {
      return { ok: false, error: "You already have a subscription. Use Switch plan instead." };
    }
    const customerId = await ensureCustomer(ws, session.email);
    // Meta Ads: the browser ids ride along in the subscription metadata so the
    // webhook can attribute the first payment; only with advertising consent.
    const meta = await readMetaRequestContext();
    const checkout = await createCheckoutSession(
      ws,
      customerId,
      plan,
      { successUrl: `${BILLING_RETURN()}&checkout=success`, cancelUrl: `${BILLING_RETURN()}&checkout=cancelled` },
      meta.consent ? { fbp: meta.fbp, fbc: meta.fbc } : null,
    );
    url = checkout.url;
  } catch (error) {
    console.error(JSON.stringify({ scope: "billing", event: "checkout.failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
  if (!url) return { ok: false, error: "Could not start checkout. Please try again." };
  if (isMetaEventId(metaEventId)) {
    after(() =>
      sendMetaEvent({
        eventName: "InitiateCheckout",
        eventId: metaEventId,
        value: plan.priceCents / 100,
        currency: "USD",
        customData: { content_name: plan.key },
        userData: { email: session.email, externalId: session.userId },
      }),
    );
  }
  redirect(url);
}

async function requireSwitchable(planKey: string) {
  const session = await requireSession();
  if (session.role === "member") return { error: "Only owners and admins can change the plan." } as const;
  const ws = session.workspace;
  let subscriptionId: string | null;
  try {
    subscriptionId = await activeSubscriptionId(ws);
  } catch {
    return { error: "Could not reach billing. Please try again." } as const;
  }
  if (!subscriptionId) return { error: "No active subscription to switch." } as const;
  if (ws.plan_key === planKey) return { error: "You are already on this plan." } as const;
  const plan = await getCataloguePlan(planKey);
  if (!plan) return { error: "That plan is not available." } as const;
  return { session, plan, subscriptionId } as const;
}

export interface PlanSwitchPreview extends SwitchPreview {
  planKey: string;
  planName: string;
  /** Credits granted right away once the invoice is paid (0 for downgrades). */
  creditsNow: number;
}

/** Exact prorated amount for switching the current subscription to `planKey`. */
export async function previewPlanSwitch(planKey: string): Promise<Result<PlanSwitchPreview>> {
  const ctx = await requireSwitchable(planKey);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  try {
    const preview = await previewSwitch(ctx.subscriptionId, ctx.plan);
    const current = ctx.session.workspace.plan_key ? await getCataloguePlan(ctx.session.workspace.plan_key) : null;
    return {
      ok: true,
      data: { ...preview, planKey: ctx.plan.key, planName: ctx.plan.name, creditsNow: Math.max(0, ctx.plan.credits - (current?.credits ?? 0)) },
    };
  } catch (error) {
    console.error(JSON.stringify({ scope: "billing", event: "switch_preview.failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, error: "Could not price the plan change. Please try again." };
  }
}

/** Applies the switch at the previewed proration date (valid for 30 minutes). */
export async function confirmPlanSwitch(planKey: string, prorationDate: number): Promise<Result<{ status: "switched" } | { status: "requires_action"; url: string | null }>> {
  const ctx = await requireSwitchable(planKey);
  if ("error" in ctx) return { ok: false, error: ctx.error! };
  const age = Date.now() / 1000 - prorationDate;
  if (!Number.isFinite(age) || age < -60 || age > 30 * 60) return { ok: false, error: "This price quote expired. Please review the change again." };
  try {
    return { ok: true, data: await applySwitch(ctx.subscriptionId, ctx.plan, prorationDate) };
  } catch (error) {
    console.error(JSON.stringify({ scope: "billing", event: "switch.failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, error: "The plan change failed. Your current plan is unchanged." };
  }
}

/** Stripe customer portal: payment method, invoices, cancel at period end, switch plan. */
export async function openBillingPortal(): Promise<Result<never>> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can manage billing." };
  let url: string;
  try {
    const customerId = await ensureCustomer(session.workspace, session.email);
    const portal = await createPortalSession(customerId, BILLING_RETURN());
    url = portal.url;
  } catch (error) {
    console.error(JSON.stringify({ scope: "billing", event: "portal.failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, error: "Could not open the billing portal. Please try again." };
  }
  redirect(url);
}

/* ----------------------------------------------------------------- overspend */

export async function fetchOverspendOverview(): Promise<OverspendOverview> {
  return getOverspendOverview(await requireSession());
}

export async function fetchOverspendStart(): Promise<OverspendStart> {
  return getOverspendStart(await requireSession());
}

const OVERSPEND_INELIGIBLE: Record<string, string> = {
  internal: "This workspace cannot use overspend.",
  trial: "Overspend needs an active plan. Choose a plan first.",
  no_subscription: "Overspend needs an active plan. Choose a plan first.",
  no_payment_method: "Add a payment method under Manage billing first.",
};

/**
 * Turn overspend on (after the confirmation dialog) or off. Enabling checks
 * the plan and the card on file and records who confirmed the terms.
 */
export async function setOverspendEnabled(enabled: boolean): Promise<Result<{ card: PaymentMethodSummary | null }>> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can change overspend." };
  const ws = session.workspace;
  const admin = createAdminClient();
  if (!enabled) {
    const { error } = await admin.from("workspaces").update({ overspend_enabled: false }).eq("id", ws.id);
    if (error) return { ok: false, error: "Could not save. Please try again." };
    return { ok: true, data: { card: null } };
  }
  const eligibility = overspendEligibility(ws);
  if (!eligibility.eligible) return { ok: false, error: OVERSPEND_INELIGIBLE[eligibility.reason] };
  let card: PaymentMethodSummary | null;
  try {
    card = await paymentMethodSummary(ws);
  } catch {
    return { ok: false, error: "Could not reach billing. Please try again." };
  }
  if (!card) return { ok: false, error: OVERSPEND_INELIGIBLE.no_payment_method };
  const { error } = await admin
    .from("workspaces")
    .update({ overspend_enabled: true, overspend_enabled_at: new Date().toISOString(), overspend_enabled_by: session.userId })
    .eq("id", ws.id);
  if (error) return { ok: false, error: "Could not save. Please try again." };
  return { ok: true, data: { card } };
}

/** Monthly limit in credits; null removes it. */
export async function setOverspendLimit(limit: number | null): Promise<Result> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can change overspend." };
  const clean = limit == null ? null : Math.floor(Number(limit));
  if (clean != null && (!Number.isFinite(clean) || clean <= 0)) return { ok: false, error: "The limit must be a positive number of credits." };
  const { error } = await createAdminClient().from("workspaces").update({ overspend_monthly_limit: clean }).eq("id", session.workspace.id);
  if (error) return { ok: false, error: "Could not save. Please try again." };
  return { ok: true, data: undefined };
}

/** Charge the unpaid overspend invoice again with the card on file. */
export async function retryOverspendPaymentAction(): Promise<Result<{ status: "paid" | "action_required"; url: string | null }>> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can manage billing." };
  try {
    const outcome = await retryOverspendPayment(createAdminClient(), session.workspace.id);
    if (outcome.status === "paid") return { ok: true, data: { status: "paid", url: null } };
    if (outcome.status === "action_required") return { ok: true, data: { status: "action_required", url: outcome.url } };
    if (outcome.status === "nothing") return { ok: false, error: "There is no unpaid overspend invoice." };
    return { ok: false, error: "The payment was declined again. Update your card under Manage billing and retry." };
  } catch (error) {
    console.error(JSON.stringify({ scope: "billing", event: "overspend_retry.failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, error: "Could not retry the payment. Please try again." };
  }
}
