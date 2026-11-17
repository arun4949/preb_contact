import "server-only";

import { isLiveMode, stripe } from "./client";

/**
 * A customer's invoices, read live from Stripe for the admin account page.
 * Invoices are not stored in our database (only single invoice ids on grants
 * and overspend rows), so this is the one place a "total paid" figure can
 * come from. Read-only: nothing is created or changed.
 */
export interface CustomerInvoice {
  id: string;
  number: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  status: string;
  amountPaidCents: number;
  amountDueCents: number;
  currency: string;
  hostedUrl: string | null;
  description: string | null;
}

export type CustomerInvoices =
  /** The workspace never opened a checkout: there is nothing to ask Stripe. */
  | { state: "none" }
  /** The customer id belongs to the other Stripe mode (dev and production share the database). */
  | { state: "other_mode" }
  | { state: "error"; message: string }
  | { state: "ok"; invoices: CustomerInvoice[]; totalPaidCents: number; currency: string; hasMore: boolean };

/** Stripe returns at most this many per page; older invoices are reachable through the dashboard link. */
export const INVOICE_LIMIT = 100;

export async function listCustomerInvoices(customerId: string | null): Promise<CustomerInvoices> {
  if (!customerId) return { state: "none" };
  try {
    const page = await stripe().invoices.list({ customer: customerId, limit: INVOICE_LIMIT });
    const invoices: CustomerInvoice[] = page.data.map((invoice) => ({
      id: invoice.id ?? "",
      number: invoice.number ?? null,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      status: invoice.status ?? "draft",
      amountPaidCents: invoice.amount_paid,
      amountDueCents: invoice.amount_due,
      currency: invoice.currency,
      hostedUrl: invoice.hosted_invoice_url ?? null,
      description: invoice.description ?? invoice.lines?.data[0]?.description ?? null,
    }));
    return {
      state: "ok",
      invoices,
      totalPaidCents: invoices.reduce((sum, invoice) => sum + (invoice.status === "paid" ? invoice.amountPaidCents : 0), 0),
      currency: invoices[0]?.currency ?? "usd",
      hasMore: page.has_more,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "resource_missing") return { state: "other_mode" };
    return { state: "error", message: error instanceof Error ? error.message : "Stripe could not be reached" };
  }
}

/** The customer in the Stripe dashboard of the mode this environment runs in. */
export function stripeCustomerUrl(customerId: string): string {
  return `https://dashboard.stripe.com/${isLiveMode() ? "" : "test/"}customers/${encodeURIComponent(customerId)}`;
}
