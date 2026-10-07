import "server-only";

import { createClient } from "@/utils/supabase/server";
import { getPlan, type Plan } from "@/lib/credits/plans";
import { getCataloguePlan, type CataloguePlan } from "@/lib/stripe/catalogue";
import type { SessionContext } from "@/lib/supabase/queries";
import type { Tables } from "@/lib/supabase/types";

export interface GrantSummary {
  id: string;
  amount: number;
  remaining: number;
  expiresAt: string;
  source: Tables<"credit_grants">["source"];
  note: string | null;
}

export interface LedgerEntry {
  id: number;
  createdAt: string;
  kind: Tables<"credit_ledger">["kind"];
  delta: number;
  note: string | null;
  listName: string | null;
  listId: string | null;
}

export interface BillingOverview {
  role: SessionContext["role"];
  canManage: boolean;
  available: number;
  isTrial: boolean;
  hasCustomer: boolean;
  plan: (Plan & Partial<Pick<CataloguePlan, "priceCents">>) | null;
  subscription: { status: string | null; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
  grants: GrantSummary[];
  ledger: LedgerEntry[];
}

export const LEDGER_PAGE = 50;

/** Everything the Billing settings page shows. Reads through RLS (members may see; owners/admins manage). */
export async function getBillingOverview(session: SessionContext): Promise<BillingOverview> {
  const supabase = await createClient();
  const ws = session.workspace;
  const [{ data: available }, { data: grants }, { data: ledger }] = await Promise.all([
    supabase.rpc("credits_available", { ws: ws.id }),
    supabase
      .from("credit_grants")
      .select("id, amount, remaining, expires_at, source, note")
      .eq("workspace_id", ws.id)
      .gt("remaining", 0)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true }),
    supabase
      .from("credit_ledger")
      .select("id, created_at, kind, delta, note, list_id, list:lists(name)")
      .eq("workspace_id", ws.id)
      .neq("delta", 0) // zero-delta adjust rows are reconciliation notes, not activity
      .order("created_at", { ascending: false })
      .limit(LEDGER_PAGE),
  ]);

  const base = getPlan(ws.plan_key);
  let plan: BillingOverview["plan"] = base ?? null;
  if (base) {
    try {
      const live = await getCataloguePlan(base.key);
      if (live) plan = live;
    } catch {
      // Stripe unreachable: show the plan without a price.
    }
  }

  return {
    role: session.role,
    canManage: session.role !== "member",
    available: available ?? 0,
    isTrial: !ws.plan_key,
    hasCustomer: Boolean(ws.stripe_customer_id),
    plan,
    subscription: ws.stripe_subscription_id
      ? { status: ws.subscription_status, cancelAtPeriodEnd: ws.cancel_at_period_end, currentPeriodEnd: ws.current_period_end }
      : null,
    grants: (grants ?? []).map((g) => ({ id: g.id, amount: g.amount, remaining: g.remaining, expiresAt: g.expires_at, source: g.source, note: g.note })),
    ledger: (ledger ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      kind: row.kind,
      delta: row.delta,
      note: row.note,
      listId: row.list_id,
      listName: (row.list as { name: string } | null)?.name ?? null,
    })),
  };
}
