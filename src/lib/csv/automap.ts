/**
 * Header → Preb field heuristics for the mapping step. Matching is
 * case-insensitive on a normalised header (letters/digits only), with a
 * first-match-wins pass over the synonym lists in priority order.
 */
export type PrebField =
  | "full_name"
  | "first_name"
  | "last_name"
  | "company_name"
  | "domain"
  | "linkedin_url"
  | "email";

export const PREB_FIELDS: { key: PrebField; label: string; hint: string }[] = [
  { key: "full_name", label: "Full name", hint: "Used when first and last name are missing" },
  { key: "first_name", label: "First name", hint: "Given name" },
  { key: "last_name", label: "Last name", hint: "Family name" },
  { key: "company_name", label: "Company", hint: "Company name" },
  { key: "domain", label: "Domain", hint: "Company website or domain" },
  { key: "linkedin_url", label: "LinkedIn URL", hint: "Profile or Sales Navigator URL" },
  { key: "email", label: "Email", hint: "Existing email, if any" },
];

/** `null` = not mapped. Values are column indexes into the parsed header row. */
export type ColumnMapping = Record<PrebField, number | null>;

export const EMPTY_MAPPING: ColumnMapping = {
  full_name: null,
  first_name: null,
  last_name: null,
  company_name: null,
  domain: null,
  linkedin_url: null,
  email: null,
};

const SYNONYMS: Record<PrebField, string[]> = {
  first_name: ["firstname", "first", "givenname", "forename", "vorname", "prenom", "nombre", "fname"],
  last_name: ["lastname", "last", "surname", "familyname", "nachname", "nom", "apellido", "lname", "secondname"],
  full_name: ["fullname", "name", "contactname", "personname", "candidate", "candidatename", "leadname", "prospectname", "nameandsurname"],
  linkedin_url: ["linkedinurl", "linkedin", "linkedinprofile", "linkedinprofileurl", "profileurl", "linkedinlink", "liurl", "salesnavigatorurl", "navigatorurl", "personlinkedinurl"],
  email: ["email", "emailaddress", "workemail", "businessemail", "mail", "emailadresse", "courriel", "contactemail", "primaryemail"],
  domain: ["domain", "companydomain", "website", "companywebsite", "websiteurl", "url", "web", "site", "companyurl", "organizationwebsite", "homepage"],
  company_name: ["company", "companyname", "organization", "organisation", "employer", "firm", "account", "accountname", "unternehmen", "entreprise", "empresa", "currentcompany", "orgname"],
};

export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Best-effort mapping of parsed headers to Preb fields. Each column is used at most once. */
export function autoMap(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  const used = new Set<number>();
  const norm = headers.map(normaliseHeader);

  // Priority order: specific fields first so "name" doesn't steal "company name".
  const order: PrebField[] = ["first_name", "last_name", "linkedin_url", "email", "domain", "company_name", "full_name"];

  const claim = (field: PrebField, idx: number) => {
    mapping[field] = idx;
    used.add(idx);
  };

  // Pass 1: exact synonym matches for every field, so a specific header
  // ("Full Name") is never stolen by a substring match from another field.
  for (const field of order) {
    const hit = norm.findIndex((h, i) => !used.has(i) && SYNONYMS[field].includes(h));
    if (hit !== -1) claim(field, hit);
  }

  // Pass 2: substring fallback ("Prospect First Name") for fields still open.
  // Short abbreviations (lname, last, url…) are exact-only to avoid false hits.
  for (const field of order) {
    if (mapping[field] != null) continue;
    const candidates = SYNONYMS[field].filter((c) => c.length >= 6);
    const hit = norm.findIndex((h, i) => !used.has(i) && h.length > 0 && candidates.some((c) => h.includes(c)));
    if (hit !== -1) claim(field, hit);
  }
  return mapping;
}
