import type { ColumnMapping } from "./automap";

/** One spreadsheet row after mapping and normalisation. */
export interface NormalisedRow {
  rowIndex: number;
  raw: Record<string, string>;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  company_name: string | null;
  domain: string | null;
  linkedin_url: string | null;
  email_input: string | null;
  /** Enrichable in `enrich` mode (names + company, or LinkedIn URL). */
  enrichable: boolean;
  /** Why the row is skipped (when not enrichable). */
  skipReason: "missing_fields" | "email_only" | "duplicate" | null;
  /** Identity used for within-list dedup and the enrichment cache. */
  dedupKey: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (!v) return null;
  // A bare email in the domain column: take the host part.
  if (v.includes("@") && EMAIL_RE.test(v)) v = v.split("@")[1];
  v = v.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  v = v.split(/[/?#]/)[0].split(":")[0];
  if (!v.includes(".") || /\s/.test(v)) return null;
  return v;
}

export function cleanLinkedin(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  if (m) return `https://www.linkedin.com/in/${decodeURIComponent(m[1]).toLowerCase().replace(/\/$/, "")}`;
  // Sales Navigator and other LinkedIn URLs are accepted as-is (FullEnrich resolves them).
  if (/linkedin\.com\//i.test(v)) return v.replace(/^http:\/\//i, "https://").replace(/^(?!https?:\/\/)/, "https://");
  return null;
}

export function cleanEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  return EMAIL_RE.test(v) ? v : null;
}

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v.length ? v : null;
}

/** "Ada Lovelace" → first/last. Handles "Lovelace, Ada" and single-token names. */
export function splitFullName(full: string): { first: string | null; last: string | null } {
  const v = full.trim();
  if (!v) return { first: null, last: null };
  if (v.includes(",")) {
    const [last, first] = v.split(",").map((p) => p.trim());
    return { first: first || null, last: last || null };
  }
  const parts = v.split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function normaliseRow(
  rowIndex: number,
  values: string[],
  headers: string[],
  mapping: ColumnMapping,
): NormalisedRow {
  const pick = (idx: number | null) => (idx == null ? null : (values[idx] ?? null));
  const raw: Record<string, string> = {};
  headers.forEach((h, i) => {
    const v = values[i];
    if (v != null && v !== "") raw[h || `Column ${i + 1}`] = String(v);
  });

  let first_name = cleanText(pick(mapping.first_name));
  let last_name = cleanText(pick(mapping.last_name));
  const full_name = cleanText(pick(mapping.full_name));
  if ((!first_name || !last_name) && full_name) {
    const split = splitFullName(full_name);
    first_name = first_name ?? split.first;
    last_name = last_name ?? split.last;
  }
  const company_name = cleanText(pick(mapping.company_name));
  const domain = cleanDomain(pick(mapping.domain));
  const linkedin_url = cleanLinkedin(pick(mapping.linkedin_url));
  const email_input = cleanEmail(pick(mapping.email));

  const hasNameCompany = Boolean(first_name && last_name && (domain || company_name));
  const enrichable = hasNameCompany || Boolean(linkedin_url);

  let dedupKey: string | null = null;
  if (linkedin_url) dedupKey = `li:${linkedin_url.toLowerCase()}`;
  else if (hasNameCompany) dedupKey = `nc:${first_name!.toLowerCase()}|${last_name!.toLowerCase()}|${(domain ?? company_name!).toLowerCase()}`;
  else if (email_input) dedupKey = `em:${email_input}`;

  const skipReason: NormalisedRow["skipReason"] = enrichable ? null : email_input ? "email_only" : "missing_fields";

  return {
    rowIndex,
    raw,
    first_name,
    last_name,
    full_name: full_name ?? (first_name && last_name ? `${first_name} ${last_name}` : null),
    company_name,
    domain,
    linkedin_url,
    email_input,
    enrichable,
    skipReason,
    dedupKey,
  };
}

export interface RowSummary {
  total: number;
  enrichable: number;
  missingFields: number;
  emailOnly: number;
  duplicates: number;
}

/** Normalises every row, marks within-list duplicates and returns rows + counts. */
export function normaliseRows(rows: string[][], headers: string[], mapping: ColumnMapping): { rows: NormalisedRow[]; summary: RowSummary } {
  const seen = new Set<string>();
  const out: NormalisedRow[] = [];
  const summary: RowSummary = { total: rows.length, enrichable: 0, missingFields: 0, emailOnly: 0, duplicates: 0 };
  rows.forEach((values, i) => {
    const row = normaliseRow(i, values, headers, mapping);
    if (row.dedupKey) {
      if (seen.has(row.dedupKey)) {
        row.enrichable = false;
        row.skipReason = "duplicate";
      } else {
        seen.add(row.dedupKey);
      }
    }
    if (row.enrichable) summary.enrichable += 1;
    else if (row.skipReason === "duplicate") summary.duplicates += 1;
    else if (row.skipReason === "email_only") summary.emailOnly += 1;
    else summary.missingFields += 1;
    out.push(row);
  });
  return { rows: out, summary };
}
