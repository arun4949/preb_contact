import type { Tables } from "@/lib/supabase/types";

export type ContactRow = Tables<"list_contacts">;

/** Download / filter segments. Email segments follow the work-email status the dashboard counters use. */
export type Segment = "all" | "valid" | "risky" | "not_found";

export const SEGMENTS: { id: Segment; label: string; description: string }[] = [
  { id: "all", label: "All contacts", description: "Every row, including skipped ones with the reason" },
  { id: "valid", label: "Valid emails", description: "Deliverable work emails" },
  { id: "risky", label: "Risky emails", description: "Catch-all domains that may bounce" },
  { id: "not_found", label: "Not found", description: "Processed rows without a work email" },
];

export const VALID_STATUSES = ["DELIVERABLE", "HIGH_PROBABILITY"] as const;
export const RISKY_STATUSES = ["CATCH_ALL"] as const;
/** Rows the engine has finished with (the dashboard's `processed_rows`). */
export const PROCESSED_STATUSES = ["enriched", "not_found", "failed", "cached"] as const;

export function isSegment(value: string | null | undefined): value is Segment {
  return value === "all" || value === "valid" || value === "risky" || value === "not_found";
}

/** Human labels for `skip_reason` (export + table status). */
export const SKIP_REASON_LABEL: Record<string, string> = {
  missing_fields: "Missing name or company",
  email_only: "Email only (reverse lookup not selected)",
  duplicate: "Duplicate",
  stopped: "List stopped",
  row_limit: "Over the row limit",
  no_result: "No result from provider",
  provider_lost: "Provider lost the request",
  suppressed: "Person asked not to be contacted",
};

export type ContactUiStatus =
  | { kind: "pending" }
  | { kind: "enriched" }
  | { kind: "cached" }
  | { kind: "not_found" }
  | { kind: "skipped"; reason: string }
  | { kind: "suppressed" };

export function contactUiStatus(c: Pick<ContactRow, "status" | "skip_reason">): ContactUiStatus {
  switch (c.status) {
    case "pending":
    case "submitted":
      return { kind: "pending" };
    case "cached":
      return { kind: "cached" };
    case "enriched":
      return { kind: "enriched" };
    case "not_found":
      return { kind: "not_found" };
    case "failed":
      return { kind: "skipped", reason: SKIP_REASON_LABEL[c.skip_reason ?? ""] ?? "Failed" };
    case "skipped":
      if (c.skip_reason === "suppressed") return { kind: "suppressed" };
      return { kind: "skipped", reason: SKIP_REASON_LABEL[c.skip_reason ?? ""] ?? "Skipped" };
  }
}
