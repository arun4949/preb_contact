import "server-only";

import type { CallToolResult } from "@modelcontextprotocol/server";
import { appOrigin } from "@/lib/jobs/shared";
import { contactUiStatus, type ContactRow } from "@/lib/lists/segments";
import { emailLevel, EMAIL_LEVEL_META, CONNECT_RATE_META } from "@/lib/lists/email-levels";
import { listStatusLabel } from "@/components/application/list-card/list-status";
import type { EnrichedPhone } from "@/lib/fullenrich/types";
import type { Tables } from "@/lib/supabase/types";

/**
 * How tool results look to an assistant: a compact markdown summary the model
 * can read aloud, plus `structuredContent` with the same facts as JSON. The
 * provider is never named; email levels use the app's wording (Valid,
 * Probably valid, Catch-all).
 */

export interface ContactResult {
  id: string;
  name: string | null;
  job_title: string | null;
  company: string | null;
  company_domain: string | null;
  location: string | null;
  linkedin_url: string | null;
  work_email: string | null;
  work_email_status: string | null;
  personal_email: string | null;
  phone: string | null;
  phone_type: string | null;
  phone_connect_rate: string | null;
  status: string;
  credits: number;
}

export function contactName(c: Pick<ContactRow, "full_name" | "first_name" | "last_name" | "linkedin_url" | "email_input">): string | null {
  return (
    c.full_name ??
    ([c.first_name, c.last_name].filter(Boolean).join(" ") ||
      c.linkedin_url?.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "") ||
      c.email_input ||
      null)
  );
}

export function contactStatusText(c: Pick<ContactRow, "status" | "skip_reason">): string {
  const s = contactUiStatus(c);
  switch (s.kind) {
    case "enriched":
      return "enriched";
    case "cached":
      return "already enriched (free)";
    case "not_found":
      return "not found";
    case "pending":
      return "in progress";
    case "skipped":
      return `skipped: ${s.reason}`;
    case "suppressed":
      return "suppressed: this person asked not to be contacted";
  }
}

export function toContactResult(c: ContactRow): ContactResult {
  const workLevel = emailLevel(c.work_email_status);
  const meta = c.phone_meta as EnrichedPhone | null;
  const lineType = meta?.line_type ? meta.line_type.charAt(0) + meta.line_type.slice(1).toLowerCase() : null;
  const rate = meta?.connect_rate ? CONNECT_RATE_META[meta.connect_rate].label : null;
  return {
    id: c.id,
    name: contactName(c),
    job_title: c.job_title,
    company: c.company ?? c.company_name,
    company_domain: c.company_domain ?? c.domain,
    location: c.location,
    linkedin_url: c.linkedin_url,
    work_email: c.work_email,
    work_email_status: c.work_email ? (workLevel ? EMAIL_LEVEL_META[workLevel].label : null) : null,
    personal_email: c.personal_email,
    phone: c.phone,
    phone_type: c.phone ? lineType : null,
    phone_connect_rate: c.phone ? rate : null,
    status: contactStatusText(c),
    credits: c.credits_cost,
  };
}

const cell = (v: string | null | undefined) => (v ? v.replace(/\|/g, "\\|") : "—");

/** Markdown table of results. Columns follow the Enrich tab. */
export function contactsTable(rows: ContactResult[]): string {
  if (rows.length === 0) return "_No contacts._";
  const head = "| Name | Work email | Personal email | Mobile | Job title | Company | Status |\n|---|---|---|---|---|---|---|";
  const lines = rows.map((r) =>
    `| ${cell(r.name)} | ${r.work_email ? `${r.work_email} (${r.work_email_status ?? "unknown"})` : "—"} | ${cell(r.personal_email)} | ${r.phone ? `${r.phone}${r.phone_connect_rate ? ` (${r.phone_connect_rate} connect rate)` : ""}` : "—"} | ${cell(r.job_title)} | ${cell(r.company)} | ${r.status} |`,
  );
  return [head, ...lines].join("\n");
}

export type ListRow = Tables<"lists">;

export interface RunSummary {
  run_id: string;
  name: string;
  status: string;
  status_label: string;
  started_from: string;
  total_contacts: number;
  processed_contacts: number;
  found_work_emails: number;
  found_personal_emails: number;
  found_phones: number;
  credits_used: number;
  created_at: string;
  url: string;
}

export function runUrl(list: Pick<ListRow, "id" | "source">): string {
  const origin = appOrigin();
  return list.source === "csv" ? `${origin}/lists/${list.id}` : `${origin}/enrich`;
}

export function runStatusText(list: Pick<ListRow, "status" | "pause_reason">): string {
  return listStatusLabel(list);
}

export function toRunSummary(list: ListRow): RunSummary {
  return {
    run_id: list.id,
    name: list.name,
    status: list.status,
    status_label: runStatusText(list),
    started_from: list.source === "csv" ? "list upload" : list.source === "mcp" ? `${list.source_detail ?? "AI assistant"} (this connection type)` : "Enrich tab",
    total_contacts: list.total_rows,
    processed_contacts: list.processed_rows,
    found_work_emails: list.found_work_email,
    found_personal_emails: list.found_personal_email,
    found_phones: list.found_phone,
    credits_used: list.credits_used,
    created_at: list.created_at,
    url: runUrl(list),
  };
}

/** What to tell the user when a run is waiting. */
export function pauseAdvice(list: Pick<ListRow, "status" | "pause_reason">): string | null {
  if (list.status !== "paused_credits") return null;
  const origin = appOrigin();
  switch (list.pause_reason) {
    case "overspend_limit":
      return `The run is paused because the workspace's monthly overspend limit is reached. Raise the limit or add credits under Settings > Billing (${origin}/lists?settings=billing) and it continues automatically within a minute.`;
    case "overspend_payment":
      return `The run is paused because an overspend payment failed. Fix the payment under Settings > Billing (${origin}/lists?settings=billing) and it continues automatically within a minute.`;
    default:
      return `The run is paused because the workspace is out of credits. Add credits under Settings > Billing (${origin}/lists?settings=billing&plan=1) and it continues automatically within a minute.`;
  }
}

export const TERMINAL_STATUSES = new Set<ListRow["status"]>(["completed", "stopped", "failed"]);
export const WAITING_STATUSES = new Set<ListRow["status"]>(["paused_credits", "paused_upstream"]);

/** Build a tool result from a markdown summary plus structured data. */
export function result(text: string, structured: Record<string, unknown>): CallToolResult {
  return { content: [{ type: "text", text }], structuredContent: structured };
}

/** A tool error the assistant should show to the user. */
export function failure(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], structuredContent: { error: message }, isError: true };
}
