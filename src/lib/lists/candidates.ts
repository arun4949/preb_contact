import { isBillableEmail, isUsablePhone } from "@/lib/fullenrich/mapping";
import type { EnrichedEmail, EnrichedPhone, EnrichmentRecord } from "@/lib/fullenrich/types";
import type { Json } from "@/lib/supabase/types";
import { emailLevel, type EmailLevel } from "./email-levels";

/**
 * Every address or number the enrichment returned for one contact, read from
 * the stored provider record (`list_contacts.result`). The most probable
 * entry (the one shown in the table) comes first; the rest are the other
 * candidates. Malformed or missing JSON yields an empty list.
 */
export interface EmailCandidate {
  email: string;
  level: EmailLevel;
}

function contactInfo(result: Json | null | undefined): Partial<EnrichmentRecord["contact_info"]> | null {
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const info = (result as { contact_info?: unknown }).contact_info;
  if (!info || typeof info !== "object" || Array.isArray(info)) return null;
  return info as Partial<EnrichmentRecord["contact_info"]>;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function emailCandidates(result: Json | null | undefined, field: "work" | "personal"): EmailCandidate[] {
  const info = contactInfo(result);
  if (!info) return [];
  const primary = field === "work" ? info.most_probable_work_email : info.most_probable_personal_email;
  const all = asArray<Partial<EnrichedEmail>>(field === "work" ? info.work_emails : info.personal_emails);
  const seen = new Set<string>();
  const out: EmailCandidate[] = [];
  for (const e of [primary, ...all]) {
    if (!e || typeof e.email !== "string" || !e.email) continue;
    const key = e.email.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    const level = emailLevel(e.status);
    if (!level || !isBillableEmail(e.status)) continue;
    seen.add(key);
    out.push({ email: e.email.trim(), level });
  }
  return out;
}

export function phoneCandidates(result: Json | null | undefined): EnrichedPhone[] {
  const info = contactInfo(result);
  if (!info) return [];
  const all = asArray<Partial<EnrichedPhone>>(info.phones);
  const seen = new Set<string>();
  const out: EnrichedPhone[] = [];
  for (const p of [info.most_probable_phone, ...all]) {
    if (!p || typeof p.number !== "string" || !p.number) continue;
    const key = p.number.replace(/[^\d+]/g, "");
    if (!key || seen.has(key)) continue;
    if (!isUsablePhone(p as EnrichedPhone)) continue;
    seen.add(key);
    out.push(p as EnrichedPhone);
  }
  return out;
}
