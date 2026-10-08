import { EMPTY_MAPPING, type ColumnMapping } from "@/lib/csv/automap";
import type { EnrichmentField } from "@/lib/credits/estimate";
import type { NormalisedRow } from "@/lib/csv/normalize";

/** Pure helpers for the Enrich tab (kept out of the "use server" actions file). */

export const MANUAL_MAX_CONTACTS = 25;

export interface ManualContact {
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  domain?: string;
}

export interface ManualEnrichmentInput {
  contacts: ManualContact[];
  fields: EnrichmentField[];
}

export type ManualEnrichmentResult = { ok: true; listId: string } | { ok: false; error: string; shortBy?: number };

export const MANUAL_HEADERS = ["First name", "Last name", "Company domain", "LinkedIn URL"];
export const MANUAL_MAPPING: ColumnMapping = { ...EMPTY_MAPPING, first_name: 0, last_name: 1, domain: 2, linkedin_url: 3 };

/** Display name for a manual run: the first person, plus how many more. */
export function manualListName(rows: NormalisedRow[], now = new Date()): string {
  const usable = rows.filter((r) => r.enrichable);
  const first = usable[0];
  const label =
    first?.full_name ??
    ([first?.first_name, first?.last_name].filter(Boolean).join(" ") || null) ??
    first?.linkedin_url?.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "") ??
    null;
  if (!label) return `Manual enrichment, ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const more = usable.length - 1;
  return (more > 0 ? `${label} + ${more} more` : label).slice(0, 120);
}
