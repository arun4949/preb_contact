"use server";

import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/queries";
import { appOrigin } from "@/lib/jobs/shared";
import { getCatalogue, getCataloguePlan, type CataloguePlan } from "@/lib/stripe/catalogue";
import { createCheckoutSession, ensureCustomer } from "@/lib/stripe/checkout";
import { createPortalSession } from "@/lib/stripe/portal";
import { applySwitch, previewSwitch, type SwitchPreview } from "@/lib/stripe/subscription";
import { getBillingOverview, type BillingOverview } from "./queries";

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
    const plans = await getCatalogue();
    return {
      ok: true,
      data: {
        plans,
        currentPlanKey: session.workspace.plan_key,
        hasSubscription: Boolean(session.workspace.stripe_subscription_id) && session.workspace.subscription_status !== "canceled",
        canManage: session.role !== "member",
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load plans." };
  }
}

/** New subscribers: Stripe Checkout. Existing subscribers use `previewPlanSwitch` + `confirmPlanSwitch`. */
export async function startCheckout(planKey: string): Promise<Result<never>> {
  const session = await requireSession();
  if (session.role === "member") return { ok: false, error: "Only owners and admins can change the plan." };
  const plan = await getCataloguePlan(planKey);
  if (!plan) return { ok: false, error: "That plan is not available." };
  const ws = session.workspace;
  if (ws.stripe_subscription_id && ws.subscription_status !== "canceled") {
    return { ok: false, error: "You already have a subscription — use Switch plan." };
  }

  let url: string | null = null;
  try {
    const customerId = await ensureCustomer(ws, session.email);
    const checkout = await createCheckoutSession(ws, customerId, plan, {
      successUrl: `${BILLING_RETURN()}&checkout=success`,
      cancelUrl: `${BILLING_RETURN()}&checkout=cancelled`,
    });
    url = checkout.url;
  } catch (error) {
    console.error(JSON.stringify({ scope: "billing", event: "checkout.failed", error: error instanceof Error ? error.message : String(error) }));
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
  if (!url) return { ok: false, error: "Could not start checkout. Please try again." };
  redirect(url);
}

async function requireSwitchable(planKey: string) {
  const session = await requireSession();
  if (session.role === "member") return { error: "Only owners and admins can change the plan." } as const;
  const ws = session.workspace;
  if (!ws.stripe_subscription_id || ws.subscription_status === "canceled") return { error: "No active subscription to switch." } as const;
  if (ws.plan_key === planKey) return { error: "You are already on this plan." } as const;
  const plan = await getCataloguePlan(planKey);
  if (!plan) return { error: "That plan is not available." } as const;
  return { session, plan, subscriptionId: ws.stripe_subscription_id } as const;
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
