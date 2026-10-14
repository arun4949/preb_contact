import { autoMap } from "@/lib/csv/automap";
import { cleanDomain, cleanLinkedin, normaliseRows, splitFullName, type NormalisedRow, type RowSummary } from "@/lib/csv/normalize";
import type { ParsedSheet } from "@/lib/csv/parse";
import { MANUAL_HEADERS, MANUAL_MAPPING } from "@/lib/lists/manual";
import { LEAD_MAX_ROWS } from "./constants";

/**
 * Pasted contacts for a lead list, one per line. Accepted shapes:
 *   https://www.linkedin.com/in/handle
 *   First Last, company.com
 *   First Last @ company.com
 *   First Last; company.com      (also tab separated)
 *   First Last company.com       (last token is a domain or URL)
 * Returns cells in `MANUAL_HEADERS` order: first, last, domain, LinkedIn URL.
 */
export interface PastedParse {
  cells: string[][];
  /** Lines that could not be read (shown back to the admin). */
  rejected: string[];
  /** True when more than LEAD_MAX_ROWS usable lines were pasted. */
  truncated: boolean;
}

const DOMAINISH = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?$/i;

export function parsePastedContacts(text: string, limit = LEAD_MAX_ROWS): PastedParse {
  const cells: string[][] = [];
  const rejected: string[] = [];
  let truncated = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parsed = parseLine(line);
    if (!parsed) {
      rejected.push(line);
      continue;
    }
    if (cells.length >= limit) {
      truncated = true;
      continue;
    }
    cells.push(parsed);
  }
  return { cells, rejected, truncated };
}

function parseLine(line: string): string[] | null {
  const linkedin = cleanLinkedin(line);
  if (linkedin && /linkedin\.com/i.test(line) && !/[,;\t]/.test(line)) return ["", "", "", linkedin];

  // "Name <sep> domain" with an explicit separator first, then whitespace.
  let name: string | null = null;
  let rest: string | null = null;
  const sep = line.match(/^(.*?)\s*(?:,|;|\t|\s@\s|@)\s*(\S.*)$/);
  if (sep && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line)) {
    name = sep[1];
    rest = sep[2];
  } else {
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && DOMAINISH.test(parts[parts.length - 1])) {
      rest = parts.pop()!;
      name = parts.join(" ");
    }
  }
  if (!name || !rest) return null;
  const domain = cleanDomain(rest);
  const restLinkedin = cleanLinkedin(rest);
  const { first, last } = splitFullName(name.trim());
  if (restLinkedin) return [first ?? "", last ?? "", "", restLinkedin];
  if (!domain || !first || !last) return null;
  return [first, last, domain, ""];
}

/** The pasted cells through the same normaliser the Enrich tab uses. */
export function normalisePasted(cells: string[][]): { rows: NormalisedRow[]; summary: RowSummary } {
  return normaliseRows(cells, MANUAL_HEADERS, MANUAL_MAPPING);
}

/** An uploaded sheet: automatic mapping, then the normaliser. Returns the mapping too, so it can be stored on the list. */
export function normaliseSheet(sheet: ParsedSheet) {
  const mapping = autoMap(sheet.headers);
  const { rows, summary } = normaliseRows(sheet.rows, sheet.headers, mapping);
  return { rows, summary, mapping, headers: sheet.headers };
}
