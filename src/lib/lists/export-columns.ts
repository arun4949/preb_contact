import { uiEmailStatus } from "@/lib/fullenrich/mapping";
import type { EmailStatus, EnrichedPhone } from "@/lib/fullenrich/types";
import { contactUiStatus, type ContactRow } from "@/lib/lists/segments";

/** The Preb result columns appended to every CSV export (lists and the Enrich tab). */
export const PREB_COLUMNS = [
  "Preb: Work email",
  "Preb: Work email status",
  "Preb: Personal email",
  "Preb: Personal email status",
  "Preb: Phone",
  "Preb: Phone type",
  "Preb: Job title",
  "Preb: Company",
  "Preb: Company domain",
  "Preb: Location",
  "Preb: LinkedIn URL",
  "Preb: Status",
  "Preb: Credits",
] as const;

function emailStatusLabel(status: string | null): string {
  if (!status) return "";
  const ui = uiEmailStatus(status as EmailStatus);
  return ui === "valid" ? "Valid" : ui === "risky" ? "Risky (catch-all)" : "Not found";
}

function phoneType(meta: ContactRow["phone_meta"]): string {
  const type = (meta as EnrichedPhone | null)?.line_type;
  if (!type) return "";
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function statusLabel(c: ContactRow): string {
  const s = contactUiStatus(c);
  switch (s.kind) {
    case "enriched":
      return "Enriched";
    case "cached":
      return "Already enriched";
    case "not_found":
      return "Not found";
    case "pending":
      return "Pending";
    case "skipped":
      return `Skipped: ${s.reason}`;
    case "suppressed":
      return "Suppressed";
  }
}

export function rowCells(c: ContactRow, headers: string[]): unknown[] {
  const raw = (c.raw ?? {}) as Record<string, unknown>;
  const original = headers.map((h) => raw[h] ?? "");
  return [
    ...original,
    c.work_email ?? "",
    emailStatusLabel(c.work_email ? c.work_email_status : null),
    c.personal_email ?? "",
    emailStatusLabel(c.personal_email ? c.personal_email_status : null),
    c.phone ?? "",
    phoneType(c.phone_meta),
    c.job_title ?? "",
    c.company ?? c.company_name ?? "",
    c.company_domain ?? c.domain ?? "",
    c.location ?? "",
    c.linkedin_url ?? "",
    statusLabel(c),
    c.credits_cost,
  ];
}
