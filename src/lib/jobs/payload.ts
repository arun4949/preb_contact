import type { BulkContactRequest, BulkEnrichRequest, EnrichField, ReverseEmailRequest } from "@/lib/fullenrich/types";
import type { EnrichmentField } from "@/lib/credits/estimate";

/** Preb field → provider `enrich_fields` value. */
export const ENRICH_FIELD_MAP: Record<EnrichmentField, EnrichField> = {
  work_email: "contact.work_emails",
  personal_email: "contact.personal_emails",
  mobile_phone: "contact.phones",
};

export function toEnrichFields(fields: readonly string[]): EnrichField[] {
  const out: EnrichField[] = [];
  for (const f of fields) {
    const mapped = ENRICH_FIELD_MAP[f as EnrichmentField];
    if (mapped && !out.includes(mapped)) out.push(mapped);
  }
  return out;
}

export interface PayloadContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  domain: string | null;
  company_name: string | null;
  linkedin_url: string | null;
  email_input: string | null;
}

/** Custom values must be strings, ≤10 keys, ≤100 chars each — ids fit easily. */
function custom(listId: string, batchId: string, contactId: string): Record<string, string> {
  return { contact_id: contactId, list_id: listId, batch_id: batchId };
}

/** Pure builder for `POST /contact/enrich/bulk`; only non-empty inputs are sent. */
export function buildEnrichPayload(
  list: { id: string; enrich_fields: readonly string[] },
  batchId: string,
  contacts: readonly PayloadContact[],
  webhookUrl: string,
): BulkEnrichRequest {
  const enrich_fields = toEnrichFields(list.enrich_fields);
  if (enrich_fields.length === 0) throw new Error("List has no enrichment fields");
  const data: BulkContactRequest[] = contacts.map((c) => {
    const row: BulkContactRequest = { enrich_fields, custom: custom(list.id, batchId, c.id) };
    if (c.first_name) row.first_name = c.first_name;
    if (c.last_name) row.last_name = c.last_name;
    if (c.domain) row.domain = c.domain;
    if (c.company_name) row.company_name = c.company_name;
    if (c.linkedin_url) row.linkedin_url = c.linkedin_url;
    return row;
  });
  return {
    name: `list_${list.id}_batch_${batchId}`,
    webhook_url: webhookUrl,
    webhook_events: { contact_finished: webhookUrl },
    data,
  };
}

/** Pure builder for `POST /contact/reverse/email/bulk` (reverse mode, day 7). */
export function buildReversePayload(
  list: { id: string },
  batchId: string,
  contacts: readonly PayloadContact[],
  webhookUrl: string,
): ReverseEmailRequest {
  return {
    name: `list_${list.id}_reverse_${batchId}`,
    webhook_url: webhookUrl,
    webhook_events: { contact_finished: webhookUrl },
    data: contacts
      .filter((c): c is PayloadContact & { email_input: string } => Boolean(c.email_input))
      .map((c) => ({ email: c.email_input, custom: custom(list.id, batchId, c.id) })),
  };
}
