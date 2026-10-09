import { createHash } from "node:crypto";
import { cleanEmail, cleanLinkedin } from "@/lib/csv/normalize";
import type { EnrichmentRecord } from "@/lib/fullenrich/types";

/**
 * Contact suppression (privacy policy § 12, Terms 9.5, DPA 9.3): a person who
 * objects is identified by a hashed email address, LinkedIn URL or phone
 * number. Pure helpers, shared by the parse step, the result step and the
 * admin page. The raw value is never stored, only `identifierHash` and a
 * masked hint.
 */
export type SuppressionKind = "email" | "linkedin" | "phone";

export interface Identifier {
  kind: SuppressionKind;
  /** Normalised value: lower-cased email, canonical lower-cased LinkedIn URL, phone digits only. */
  value: string;
}

export function normaliseIdentifier(kind: SuppressionKind, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (kind === "email") return cleanEmail(v);
  if (kind === "linkedin") {
    const url = cleanLinkedin(v);
    return url ? url.toLowerCase() : null;
  }
  const digits = v.replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

export function identifierHash(kind: SuppressionKind, value: string): string {
  return createHash("sha256").update(`${kind}:${value}`, "utf8").digest("hex");
}

/** Masked form for the admin list: a***@example.com, linkedin.com/in/j***, +1 555 *** 4567. */
export function maskIdentifier(kind: SuppressionKind, value: string): string {
  if (kind === "email") {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  if (kind === "linkedin") {
    const handle = value.replace(/^.*\/in\//, "").replace(/\/$/, "");
    return handle === value ? "linkedin.com/***" : `linkedin.com/in/${handle.slice(0, 1)}***`;
  }
  return `${value.slice(0, 1)}*** ${value.slice(-4)}`;
}

/** Parse-time identifiers of an uploaded row (what the customer gave us). */
export function inputIdentifiers(row: { email_input: string | null; linkedin_url: string | null }): Identifier[] {
  const out: Identifier[] = [];
  if (row.email_input) {
    const v = normaliseIdentifier("email", row.email_input);
    if (v) out.push({ kind: "email", value: v });
  }
  if (row.linkedin_url) {
    const v = normaliseIdentifier("linkedin", row.linkedin_url);
    if (v) out.push({ kind: "linkedin", value: v });
  }
  return out;
}

/** Every email, phone and LinkedIn URL in a provider record, normalised and de-duplicated. */
export function recordIdentifiers(record: EnrichmentRecord): Identifier[] {
  const seen = new Set<string>();
  const out: Identifier[] = [];
  const add = (kind: SuppressionKind, raw: string | null | undefined) => {
    if (!raw) return;
    const v = normaliseIdentifier(kind, raw);
    if (!v) return;
    const key = `${kind}:${v}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value: v });
  };
  const info = record.contact_info;
  add("email", record.input?.email);
  add("email", info?.most_probable_work_email?.email);
  add("email", info?.most_probable_personal_email?.email);
  for (const e of info?.work_emails ?? []) add("email", e.email);
  for (const e of info?.personal_emails ?? []) add("email", e.email);
  add("phone", info?.most_probable_phone?.number);
  for (const p of info?.phones ?? []) add("phone", p.number);
  add("linkedin", record.input?.professional_network_url);
  add("linkedin", record.profile?.social_profiles?.professional_network?.url);
  return out;
}

export function hashesOf(ids: readonly Identifier[]): string[] {
  return ids.map((i) => identifierHash(i.kind, i.value));
}

/** `enrichment_cache.input_hash` values a suppressed identifier can appear under (the li:/em: dedup keys). */
export function cacheHashesFor(kind: SuppressionKind, value: string): string[] {
  if (kind === "email") return [createHash("sha256").update(`em:${value}`).digest("hex")];
  if (kind === "linkedin") return [createHash("sha256").update(`li:${value}`).digest("hex")];
  return [];
}
