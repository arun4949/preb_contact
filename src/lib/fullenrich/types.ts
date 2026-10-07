/**
 * FullEnrich API v2 types — see docs/fullenrich.md. Never surface these names
 * in UI; the app talks about "the enrichment network".
 */

export type EnrichField = "contact.work_emails" | "contact.personal_emails" | "contact.phones";

export type EmailStatus = "DELIVERABLE" | "HIGH_PROBABILITY" | "CATCH_ALL" | "INVALID" | "INVALID_DOMAIN";

export interface EnrichedEmail {
  email: string;
  status: EmailStatus;
}

export interface EnrichedPhone {
  number: string;
  region?: string;
  line_type?: "MOBILE" | "LANDLINE" | "VOIP" | "UNKNOWN";
  line_status?: "ACTIVE" | "INACTIVE" | "UNKNOWN";
  ownership_match?: "CONFIRMED" | "MISMATCH";
  ownership_match_confidence?: number;
  connect_rate?: "HIGHEST" | "HIGH" | "MEDIUM";
}

export interface CompanyProfile {
  id?: string;
  name?: string;
  domain?: string;
  website?: string;
  description?: string;
  year_founded?: number;
  headcount?: number;
  headcount_range?: string;
  company_type?: string;
  specialties?: string[];
  technologies?: string[];
  industry?: { main_industry?: string };
  logo_url?: string;
  locations?: {
    headquarters?: { line1?: string; line2?: string; city?: string; region?: string; country?: string; country_code?: string };
  };
}

export interface Employment {
  title?: string;
  seniority?: string;
  job_functions?: string[];
  description?: string;
  is_current?: boolean;
  start_at?: string;
  end_at?: string;
  company?: CompanyProfile;
}

export interface PersonProfile {
  id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  description?: string;
  location?: { country?: string; country_code?: string; city?: string; region?: string };
  social_profiles?: {
    professional_network?: { id?: string; url?: string; handle?: string; connection_count?: number };
  };
  educations?: { school_name?: string; degree?: string; start_at?: string; end_at?: string }[];
  languages?: string[];
  skills?: string[];
  employment?: { current?: Employment; all?: Employment[] };
}

export interface ContactInput {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company_domain?: string;
  company_name?: string;
  professional_network_url?: string;
  email?: string;
}

export interface ContactInfo {
  most_probable_work_email: EnrichedEmail | null;
  most_probable_personal_email: EnrichedEmail | null;
  most_probable_phone: EnrichedPhone | null;
  work_emails: EnrichedEmail[];
  personal_emails: EnrichedEmail[];
  phones: EnrichedPhone[];
}

export interface EnrichmentRecord {
  input: ContactInput;
  custom?: Record<string, string>;
  contact_info?: ContactInfo;
  profile?: PersonProfile;
}

export type EnrichmentStatus =
  | "CREATED"
  | "IN_PROGRESS"
  | "CANCELED"
  | "CREDITS_INSUFFICIENT"
  | "FINISHED"
  | "RATE_LIMIT"
  | "UNKNOWN";

export interface EnrichmentResult {
  id: string;
  name: string;
  status: EnrichmentStatus;
  cost?: { credits: number };
  data: EnrichmentRecord[];
}

export interface BulkContactRequest {
  first_name?: string;
  last_name?: string;
  domain?: string;
  company_name?: string;
  linkedin_url?: string;
  enrich_fields: EnrichField[];
  custom: Record<string, string>;
}

export interface BulkEnrichRequest {
  name: string;
  webhook_url: string;
  webhook_events?: { contact_finished?: string };
  data: BulkContactRequest[];
}

export interface ReverseEmailRequest {
  name: string;
  webhook_url: string;
  webhook_events?: { contact_finished?: string };
  data: { email: string; custom: Record<string, string> }[];
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
  [key: string]: unknown;
}
