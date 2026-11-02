import { describe, expect, it } from "vitest";
import type { Tables } from "@/lib/supabase/types";
import { contactsTable, pauseAdvice, runUrl, toContactResult, toRunSummary } from "./format";

const base: Tables<"list_contacts"> = {
  id: "c1",
  list_id: "l1",
  workspace_id: "w1",
  row_index: 0,
  raw: {},
  first_name: "Ada",
  last_name: "Lovelace",
  full_name: null,
  company_name: "Analytical",
  domain: "analytical.io",
  linkedin_url: null,
  email_input: null,
  input_hash: null,
  status: "enriched",
  skip_reason: null,
  kind: "enrich",
  credits_cost: 2,
  work_email: "ada@analytical.io",
  work_email_status: "DELIVERABLE",
  personal_email: null,
  personal_email_status: null,
  phone: "+15551234567",
  phone_meta: { line_type: "MOBILE", connect_rate: "HIGH" },
  job_title: "Engineer",
  company: "Analytical Engines",
  company_domain: null,
  company_logo_url: null,
  location: "London",
  profile: null,
  result: null,
  batch_id: null,
  enriched_at: null,
  created_at: "2026-11-02T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
} as unknown as Tables<"list_contacts">;

describe("contact results for the assistant", () => {
  it("uses the app's email levels and phone labels, never raw provider statuses", () => {
    const r = toContactResult(base);
    expect(r).toMatchObject({ name: "Ada Lovelace", work_email_status: "Valid", phone_type: "Mobile", phone_connect_rate: "High", company: "Analytical Engines", status: "enriched", credits: 2 });
    expect(toContactResult({ ...base, work_email_status: "CATCH_ALL" }).work_email_status).toBe("Catch-all");
    expect(toContactResult({ ...base, work_email_status: "HIGH_PROBABILITY" }).work_email_status).toBe("Probably valid");
    expect(toContactResult({ ...base, status: "cached" }).status).toContain("free");
    expect(toContactResult({ ...base, status: "pending" }).status).toBe("in progress");
    expect(toContactResult({ ...base, status: "skipped", skip_reason: "suppressed" }).status).toContain("asked not to be contacted");
  });

  it("renders a markdown table and escapes pipes", () => {
    const table = contactsTable([toContactResult({ ...base, job_title: "A|B" })]);
    expect(table).toContain("| Ada Lovelace | ada@analytical.io (Valid) |");
    expect(table).toContain("A\\|B");
    expect(contactsTable([])).toContain("No contacts");
  });
});

const list = {
  id: "l1",
  source: "mcp",
  source_detail: "Claude",
  name: "Ada Lovelace + 2 more",
  status: "paused_credits",
  pause_reason: null,
  total_rows: 3,
  processed_rows: 1,
  found_work_email: 1,
  found_personal_email: 0,
  found_phone: 0,
  credits_used: 2,
  created_at: "2026-11-02T10:00:00Z",
} as unknown as Tables<"lists">;

describe("run summaries", () => {
  it("links assistant and manual runs to the Enrich tab, uploads to the list page", () => {
    expect(runUrl(list)).toBe("https://app.test/enrich");
    expect(runUrl({ ...list, source: "csv" })).toBe("https://app.test/lists/l1");
    const s = toRunSummary(list);
    expect(s.status_label).toBe("Paused, needs credits");
    expect(s.started_from).toContain("Claude");
  });

  it("explains every pause reason with where to fix it", () => {
    expect(pauseAdvice(list)).toContain("out of credits");
    expect(pauseAdvice({ ...list, pause_reason: "overspend_limit" })).toContain("overspend limit");
    expect(pauseAdvice({ ...list, pause_reason: "overspend_payment" })).toContain("payment failed");
    expect(pauseAdvice({ ...list, status: "completed" })).toBeNull();
  });
});
