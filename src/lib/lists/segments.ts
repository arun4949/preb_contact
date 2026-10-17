import type { EmailStatus } from "@/lib/fullenrich/types";
import type { Tables } from "@/lib/supabase/types";
import { EMAIL_LEVEL_META, type EmailLevel } from "./email-levels";

export type ContactRow = Tables<"list_contacts">;

/**
 * Download segments. "Valid emails" bundles valid and probably valid (both
 * safe to send); catch-all is its own file for a careful second wave.
 */
export type Segment = "all" | "valid" | "catch_all" | "not_found";

export const SEGMENTS: { id: Segment; label: string; description: string }[] = [
  { id: "all", label: "All contacts", description: "Every row, including skipped ones with the reason" },
  { id: "valid", label: "Valid emails", description: "Valid and probably valid work emails, safe to send" },
  { id: "catch_all", label: "Catch-all emails", description: "Domains that accept every address, so a bounce is possible" },
  { id: "not_found", label: "Not found", description: "Processed rows without a work email" },
];

/** Table filter chips: one per email level, plus not found. */
export type EmailFilter = "all" | EmailLevel | "not_found";

export const EMAIL_FILTERS: { id: EmailFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "valid", label: EMAIL_LEVEL_META.valid.label },
  { id: "probable", label: EMAIL_LEVEL_META.probable.label },
  { id: "catch_all", label: EMAIL_LEVEL_META.catch_all.label },
  { id: "not_found", label: EMAIL_LEVEL_META.not_found.label },
];

/** Work-email statuses behind each download segment. */
export const SEGMENT_STATUSES: Record<Exclude<Segment, "all" | "not_found">, readonly EmailStatus[]> = {
  valid: ["DELIVERABLE", "HIGH_PROBABILITY"],
  catch_all: ["CATCH_ALL"],
};

/** Work-email statuses behind each table filter chip. */
export const FILTER_STATUSES: Record<EmailLevel, readonly EmailStatus[]> = {
  valid: ["DELIVERABLE"],
  probable: ["HIGH_PROBABILITY"],
  catch_all: ["CATCH_ALL"],
};

/** Rows the engine has finished with (the dashboard's `processed_rows`). */
export const PROCESSED_STATUSES = ["enriched", "not_found", "failed", "cached"] as const;

/** Parses a download segment; the legacy `risky` keeps old bookmarks working. */
export function parseSegment(value: string | null | undefined): Segment | null {
  if (value === "risky") return "catch_all";
  return value === "all" || value === "valid" || value === "catch_all" || value === "not_found" ? value : null;
}

/** Parses a table email filter; the legacy `risky` maps to catch-all. */
export function parseEmailFilter(value: string | null | undefined): EmailFilter {
  if (value === "risky") return "catch_all";
  return value === "valid" || value === "probable" || value === "catch_all" || value === "not_found" ? value : "all";
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
