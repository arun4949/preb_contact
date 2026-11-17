import type { Tables } from "@/lib/supabase/types";

/**
 * What a credit ledger row is called in the UI. One function for the customer
 * Billing page and the admin account page, so the two can never drift apart.
 * Client-safe (types only).
 */
export interface LedgerLabelInput {
  kind: Tables<"credit_ledger">["kind"];
  note: string | null;
  listName: string | null;
}

export function ledgerLabel(entry: LedgerLabelInput): string {
  switch (entry.kind) {
    case "grant":
      return entry.note ?? "Credits granted";
    case "consume":
      return entry.listName ? `Enrichment · ${entry.listName}` : "Enrichment";
    case "expire":
      return "Credits expired";
    case "adjust":
      return entry.note ?? "Adjustment";
    case "overage":
      return entry.listName ? `Overspend · ${entry.listName}` : "Overspend";
  }
}
