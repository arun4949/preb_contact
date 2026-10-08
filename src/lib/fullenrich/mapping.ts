import type { EmailStatus, EnrichedPhone, EnrichmentRecord, PersonProfile } from "./types";

/** UI email status: Valid = DELIVERABLE + HIGH_PROBABILITY · Risky = CATCH_ALL · Not found otherwise. */
export type UiEmailStatus = "valid" | "risky" | "not_found";

export function uiEmailStatus(status: EmailStatus | null | undefined): UiEmailStatus {
  if (status === "DELIVERABLE" || status === "HIGH_PROBABILITY") return "valid";
  if (status === "CATCH_ALL") return "risky";
  return "not_found";
}

export function isBillableEmail(status: EmailStatus | null | undefined): boolean {
  return status === "DELIVERABLE" || status === "HIGH_PROBABILITY" || status === "CATCH_ALL";
}

export function isMobile(phone: EnrichedPhone | null | undefined): boolean {
  return phone?.line_type === "MOBILE";
}

/** What the provider charges us per result, in provider credits. */
export const UPSTREAM_CREDIT_COST = { work_email: 1, personal_email: 3, mobile_phone: 10, reverse: 1 } as const;

/**
 * Pricing v2 (2026-10-08): 1 Preb credit = ½ provider credit. Every provider
 * charge (per-result derivation AND the authoritative batch `cost.credits`)
 * is multiplied by this before it touches our ledger.
 */
export const CREDIT_MULTIPLIER = 2;

/** What we charge the workspace per result, in Preb credits. */
export const CREDIT_COST = {
  work_email: UPSTREAM_CREDIT_COST.work_email * CREDIT_MULTIPLIER,
  personal_email: UPSTREAM_CREDIT_COST.personal_email * CREDIT_MULTIPLIER,
  mobile_phone: UPSTREAM_CREDIT_COST.mobile_phone * CREDIT_MULTIPLIER,
  reverse: UPSTREAM_CREDIT_COST.reverse * CREDIT_MULTIPLIER,
} as const;

/** Provider credits (batch `cost.credits`) → Preb credits. */
export function toPrebCredits(upstream: number): number {
  return Math.max(0, Math.round(upstream * CREDIT_MULTIPLIER));
}

/** Which provider endpoint produced a record: person → contact data, or email → profile. */
export type RecordKind = "enrich" | "reverse";

/** Reverse lookup: a record counts as identified when the provider returned a profile. */
export function isIdentified(record: EnrichmentRecord): boolean {
  const p = record.profile;
  return Boolean(p && (p.full_name || p.first_name || p.last_name || p.employment?.current || p.social_profiles?.professional_network?.url));
}

/** Per-contact cost derived from the record (reconciled to batch `cost.credits` later). */
export function contactCredits(record: EnrichmentRecord, kind: RecordKind = "enrich"): number {
  if (kind === "reverse") return isIdentified(record) ? CREDIT_COST.reverse : 0;
  const info = record.contact_info;
  if (!info) return 0;
  let credits = 0;
  if (info.most_probable_work_email && isBillableEmail(info.most_probable_work_email.status)) credits += CREDIT_COST.work_email;
  if (info.most_probable_personal_email && isBillableEmail(info.most_probable_personal_email.status)) credits += CREDIT_COST.personal_email;
  if (isMobile(info.most_probable_phone)) credits += CREDIT_COST.mobile_phone;
  return credits;
}

export function formatLocation(profile: PersonProfile | undefined): string | null {
  const loc = profile?.location;
  if (!loc) return null;
  const parts = [loc.city, loc.region, loc.country].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(", ") : null;
}

/** Columns written to `list_contacts` from one provider record. */
export interface MappedContactResult {
  work_email: string | null;
  work_email_status: EmailStatus | null;
  personal_email: string | null;
  personal_email_status: EmailStatus | null;
  phone: string | null;
  phone_meta: EnrichedPhone | null;
  job_title: string | null;
  company: string | null;
  company_domain: string | null;
  company_logo_url: string | null;
  location: string | null;
  linkedin_url: string | null;
  profile: PersonProfile | null;
  /** Names from the profile — only set for reverse records (the user's own input wins otherwise). */
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  credits_cost: number;
  found: boolean;
}

export function mapRecord(record: EnrichmentRecord, kind: RecordKind = "enrich"): MappedContactResult {
  const info = record.contact_info;
  const profile = record.profile ?? null;
  const current = profile?.employment?.current;
  const company = current?.company;
  const reverse = kind === "reverse";
  const identified = reverse && isIdentified(record);
  const split = identified && !profile?.first_name && profile?.full_name ? profile.full_name.trim().split(/\s+/) : null;

  const workEmail = info?.most_probable_work_email ?? null;
  const personalEmail = info?.most_probable_personal_email ?? null;
  const phone = info?.most_probable_phone ?? null;

  // INVALID work emails are not shown as results.
  const showWork = workEmail && isBillableEmail(workEmail.status);
  const showPersonal = personalEmail && isBillableEmail(personalEmail.status);

  const found = reverse ? identified : Boolean(showWork || showPersonal || phone);

  return {
    work_email: showWork ? workEmail.email : null,
    work_email_status: showWork ? workEmail.status : workEmail?.status ?? null,
    personal_email: showPersonal ? personalEmail.email : null,
    personal_email_status: showPersonal ? personalEmail.status : personalEmail?.status ?? null,
    phone: phone?.number ?? null,
    phone_meta: phone,
    job_title: current?.title ?? profile?.headline ?? null,
    company: company?.name ?? record.input.company_name ?? null,
    company_domain: company?.domain ?? record.input.company_domain ?? null,
    company_logo_url: company?.logo_url ?? null,
    location: formatLocation(profile ?? undefined),
    linkedin_url: profile?.social_profiles?.professional_network?.url ?? record.input.professional_network_url ?? null,
    profile,
    first_name: identified ? profile?.first_name ?? split?.[0] ?? null : null,
    last_name: identified ? profile?.last_name ?? (split && split.length > 1 ? split.slice(1).join(" ") : null) : null,
    full_name: identified ? (profile?.full_name ?? ([profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null)) : null,
    credits_cost: contactCredits(record, kind),
    found,
  };
}
