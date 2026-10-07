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

export const CREDIT_COST = { work_email: 1, personal_email: 3, mobile_phone: 10, reverse: 1 } as const;

/** Per-contact cost derived from the record (reconciled to batch `cost.credits` later). */
export function contactCredits(record: EnrichmentRecord): number {
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
  credits_cost: number;
  found: boolean;
}

export function mapRecord(record: EnrichmentRecord): MappedContactResult {
  const info = record.contact_info;
  const profile = record.profile ?? null;
  const current = profile?.employment?.current;
  const company = current?.company;

  const workEmail = info?.most_probable_work_email ?? null;
  const personalEmail = info?.most_probable_personal_email ?? null;
  const phone = info?.most_probable_phone ?? null;

  // INVALID work emails are not shown as results.
  const showWork = workEmail && isBillableEmail(workEmail.status);
  const showPersonal = personalEmail && isBillableEmail(personalEmail.status);

  const found = Boolean(showWork || showPersonal || phone);

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
    credits_cost: contactCredits(record),
    found,
  };
}
