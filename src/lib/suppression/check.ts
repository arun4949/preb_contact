import "server-only";

import type { TablesUpdate } from "@/lib/supabase/types";
import type { Admin } from "@/lib/jobs/shared";

/**
 * Server-side lookups against `contact_suppressions`. One query per batch:
 * pass every candidate hash, get back the ones that are suppressed.
 */
export async function suppressedHashes(admin: Admin, hashes: readonly string[]): Promise<Set<string>> {
  const unique = [...new Set(hashes)];
  const found = new Set<string>();
  for (let i = 0; i < unique.length; i += 500) {
    const { data, error } = await admin.from("contact_suppressions").select("value_hash").in("value_hash", unique.slice(i, i + 500));
    if (error) throw new Error(`suppression lookup: ${error.message}`);
    for (const row of data ?? []) found.add(row.value_hash);
  }
  return found;
}

/** Column patch for a contact whose person asked not to be processed: no results, no identifiers. */
export const SUPPRESSED_PATCH: TablesUpdate<"list_contacts"> = {
  status: "skipped",
  skip_reason: "suppressed",
  email_input: null,
  linkedin_url: null,
  input_hash: null,
  work_email: null,
  work_email_status: null,
  personal_email: null,
  personal_email_status: null,
  phone: null,
  phone_meta: null,
  job_title: null,
  company: null,
  company_domain: null,
  company_logo_url: null,
  location: null,
  profile: null,
  result: null,
};

/** Blank the suppressed values inside the original spreadsheet row so exports do not leak them. */
export function scrubRaw(raw: Record<string, string>, values: readonly string[]): Record<string, string> {
  const lower = new Set(values.map((v) => v.toLowerCase()));
  const digits = new Set(values.map((v) => v.replace(/\D/g, "")).filter((v) => v.length >= 6));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const l = v.trim().toLowerCase();
    const d = v.replace(/\D/g, "");
    out[k] = lower.has(l) || (d.length >= 6 && digits.has(d)) || [...lower].some((s) => s.includes("/in/") && l.includes(s.replace(/^.*\/in\//, "/in/"))) ? "" : v;
  }
  return out;
}
