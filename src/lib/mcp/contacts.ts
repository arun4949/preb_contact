import "server-only";

import { z } from "zod";
import { EMPTY_MAPPING, type ColumnMapping } from "@/lib/csv/automap";
import { normaliseRows, type NormalisedRow, type RowSummary } from "@/lib/csv/normalize";
import type { EnrichmentField } from "@/lib/credits/estimate";
import { MCP_MAX_CONTACTS } from "./config";

/**
 * Contact input shared by `estimate_enrichment` and `enrich_contacts`. The
 * same normaliser as the list wizard and the Enrich tab decides what is
 * enrichable, so the assistant gets exactly the rules the app applies.
 */

const text = (max: number) => z.string().trim().max(max).optional();

export const contactInputSchema = z
  .object({
    first_name: text(100).describe("Given name"),
    last_name: text(100).describe("Family name"),
    full_name: text(200).describe("Full name, used when first and last name are not given separately"),
    company_domain: text(200).describe("Company website or domain, for example acme.com"),
    company_name: text(200).describe("Company name, when the domain is unknown"),
    linkedin_url: text(300).describe("LinkedIn profile URL. On its own this is enough to enrich a person"),
    email: text(254).describe("An email address, when that is all you know. Preb identifies the person behind it (reverse lookup)"),
  })
  .describe("One person. Give a LinkedIn URL, or a first name, last name and company (domain or name), or only an email address.");

export type ContactInput = z.infer<typeof contactInputSchema>;

export const contactsInputSchema = z.array(contactInputSchema).min(1).max(MCP_MAX_CONTACTS).describe(`The people to enrich, at most ${MCP_MAX_CONTACTS} per call.`);

export const fieldsInputSchema = z
  .array(z.enum(["work_email", "personal_email", "mobile_phone"]))
  .min(1)
  .describe("What to find: work_email (verified business address, 2 credits when found), personal_email (6 credits when found), mobile_phone (20 credits when found). Only results are charged.");

export const MCP_HEADERS = ["First name", "Last name", "Full name", "Company", "Company domain", "LinkedIn URL", "Email"] as const;

export const MCP_MAPPING: ColumnMapping = { ...EMPTY_MAPPING, first_name: 0, last_name: 1, full_name: 2, company_name: 3, domain: 4, linkedin_url: 5, email: 6 };

export function normaliseContacts(contacts: ContactInput[]): { rows: NormalisedRow[]; summary: RowSummary } {
  const cells = contacts.map((c) => [c.first_name ?? "", c.last_name ?? "", c.full_name ?? "", c.company_name ?? "", c.company_domain ?? "", c.linkedin_url ?? "", c.email ?? ""]);
  return normaliseRows(cells, [...MCP_HEADERS], MCP_MAPPING);
}

export const FIELD_LABEL: Record<EnrichmentField, string> = {
  work_email: "work email",
  personal_email: "personal email",
  mobile_phone: "mobile phone",
};

/** "work email and mobile phone" */
export function fieldsText(fields: EnrichmentField[]): string {
  const labels = fields.map((f) => FIELD_LABEL[f]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Why a row cannot be enriched, in the user's words. */
export function skipText(row: NormalisedRow): string {
  switch (row.skipReason) {
    case "duplicate":
      return "duplicate of an earlier row";
    case "email_only":
      return "email only, will be identified by reverse lookup";
    default:
      return "needs a LinkedIn URL, or first name, last name and company";
  }
}

export function rowLabel(row: NormalisedRow): string {
  return row.full_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.linkedin_url || row.email_input || `row ${row.rowIndex + 1}`;
}
