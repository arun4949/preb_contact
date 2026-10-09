import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isLiveMode, stripe } from "@/lib/stripe/client";
import { planForPriceId, planKeyFromLookup } from "@/lib/stripe/catalogue";
import {
  customerIdOf,
  decideGrant,
  invoiceLines,
  invoiceSubscriptionId,
  invoiceWorkspaceId,
  STRIPE_PROVIDER,
  subscriptionChange,
  subscriptionPatch,
} from "@/lib/stripe/webhooks";
import { getPlan } from "@/lib/credits/plans";
import { creditsGrantedCopy, planCopy } from "@/lib/notifications/copy";
import { notifyWorkspace } from "@/lib/notifications/emit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { log, logError, type Admin } from "@/lib/jobs/shared";

export const maxDuration = 60;

/**
 * Stripe webhook: signature-verified, mode-gated (`livemode` must match the
 * configured key), idempotent by `event.id` in `webhook_events`. Grants ride
 * `invoice.paid`; subscription state mirrors `customer.subscription.*`.
 * Non-2xx makes Stripe retry, so processing errors return 500.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, request.headers.get("stripe-signature") ?? "", secret);
  } catch (error) {
    logError("stripe.invalid_signature", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }
  if (event.livemode !== isLiveMode()) {
    return NextResponse.json({ ok: true, ignored: "mode mismatch" });
  }

  const admin = createAdminClient();
  await admin
    .from("webhook_events")
    .upsert({ provider: STRIPE_PROVIDER, external_id: event.id, payload: event as unknown as Json }, { onConflict: "provider,external_id", ignoreDuplicates: true });
  const { data: stored } = await admin.from("webhook_events").select("processed_at").eq("provider", STRIPE_PROVIDER).eq("external_id", event.id).maybeSingle();
  if (stored?.processed_at) return NextResponse.json({ ok: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(admin, event.data.object);
        break;
      case "invoice.paid":
        await onInvoicePaid(admin, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await onSubscription(admin, event.data.object, false);
        break;
      case "customer.subscription.deleted":
        await onSubscription(admin, event.data.object, true);
        break;
      default:
        log("stripe.ignored", { type: event.type });
    }
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", STRIPE_PROVIDER).eq("external_id", event.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("stripe.failed", error, { eventId: event.id, type: event.type });
    await admin
      .from("webhook_events")
      .update({ error: error instanceof Error ? error.message : String(error) })
      .eq("provider", STRIPE_PROVIDER)
      .eq("external_id", event.id);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

/* ---------------------------------------------------------------- helpers */

async function workspaceIdFor(admin: Admin, customerId: string | null, hinted: string | null): Promise<string | null> {
  if (customerId) {
    const { data } = await admin.from("workspaces").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    if (data) return data.id;
  }
  if (hinted) {
    const { data } = await admin.from("workspaces").select("id").eq("id", hinted).maybeSingle();
    if (data) {
      // Customer created by Checkout itself — remember it.
      if (customerId) await admin.from("workspaces").update({ stripe_customer_id: customerId }).eq("id", data.id);
      return data.id;
    }
  }
  return null;
}

async function onCheckoutCompleted(admin: Admin, session: Stripe.Checkout.Session) {
  const customerId = customerIdOf(session);
  const wsId = session.client_reference_id ?? session.metadata?.workspace_id ?? null;
  const resolved = await workspaceIdFor(admin, customerId, wsId);
  log("stripe.checkout_completed", { workspaceId: resolved, mode: session.mode });
}

async function onInvoicePaid(admin: Admin, invoice: Stripe.Invoice) {
  const wsId = await workspaceIdFor(admin, customerIdOf(invoice), invoiceWorkspaceId(invoice));
  if (!wsId) {
    log("stripe.invoice_unknown_workspace", { invoiceId: invoice.id });
    return;
  }
  const lines = invoiceLines(invoice);
  const plans = new Map<string, Awaited<ReturnType<typeof planForPriceId>>>();
  for (const l of lines) if (l.priceId && !plans.has(l.priceId)) plans.set(l.priceId, await planForPriceId(l.priceId));
  const decision = decideGrant(invoice.billing_reason ?? null, lines, (id) => plans.get(id) ?? null);
  if (!decision) {
    log("stripe.invoice_no_grant", { invoiceId: invoice.id, reason: invoice.billing_reason });
    return;
  }
  const { data: grantId, error } = await admin.rpc("grant_credits", {
    ws: wsId,
    amount: decision.credits,
    p_source: "subscription",
    p_expires_at: decision.expiresAt.toISOString(),
    p_stripe_invoice_id: invoice.id,
    p_note: decision.note,
  });
  if (error) throw new Error(`grant_credits failed: ${error.message}`);
  await admin.from("workspaces").update({ low_credits_notified_at: null }).eq("id", wsId);
  log("stripe.granted", { workspaceId: wsId, invoiceId: invoice.id, credits: decision.credits, grantId, subscription: invoiceSubscriptionId(invoice) });
  await notifyWorkspace(admin, wsId, creditsGrantedCopy({ credits: decision.credits, note: decision.note, expiresAt: decision.expiresAt }), {
    roles: ["owner", "admin"],
    dedupeKey: `credits_granted:${invoice.id}`,
  });
}

async function onSubscription(admin: Admin, sub: Stripe.Subscription, deleted: boolean) {
  const wsId = await workspaceIdFor(admin, customerIdOf(sub), sub.metadata?.workspace_id ?? null);
  if (!wsId) {
    log("stripe.subscription_unknown_workspace", { subscriptionId: sub.id });
    return;
  }
  const price = sub.items.data[0]?.price;
  const planKey = planKeyFromLookup(price?.lookup_key) ?? (price ? (await planForPriceId(price.id))?.key ?? null : null);
  const patch = subscriptionPatch(sub, planKey, deleted);
  // A stale event for a replaced subscription must not clobber the current one.
  const { data: ws } = await admin.from("workspaces").select("stripe_subscription_id, plan_key, subscription_status, cancel_at_period_end").eq("id", wsId).maybeSingle();
  if (ws?.stripe_subscription_id && ws.stripe_subscription_id !== sub.id && !deleted) {
    const current = await stripe().subscriptions.retrieve(ws.stripe_subscription_id).catch(() => null);
    if (current && current.status !== "canceled") {
      log("stripe.subscription_ignored_stale", { subscriptionId: sub.id, current: current.id });
      return;
    }
  }
  if (deleted && ws?.stripe_subscription_id && ws.stripe_subscription_id !== sub.id) return;
  const { error: updateError } = await admin.from("workspaces").update(patch).eq("id", wsId);
  if (updateError) throw new Error(`workspace update failed: ${updateError.message}`);
  log("stripe.subscription", { workspaceId: wsId, ...patch, deleted });

  // In-app: only real changes for the customer (started, switched, cancel scheduled/reverted, canceled).
  const change = ws ? subscriptionChange(ws, patch) : null;
  if (change) {
    const planName = getPlan(change === "plan_canceled" ? ws?.plan_key ?? null : patch.plan_key)?.name ?? null;
    const previousPlanName = getPlan(ws?.plan_key ?? null)?.name ?? null;
    const dedupeKey = change === "plan_started" ? `sub:${sub.id}:started` : change === "plan_canceled" ? `sub:${sub.id}:canceled` : null;
    await notifyWorkspace(admin, wsId, planCopy(change, { planName, previousPlanName, periodEnd: patch.current_period_end }), { roles: ["owner", "admin"], dedupeKey });
  }
}
