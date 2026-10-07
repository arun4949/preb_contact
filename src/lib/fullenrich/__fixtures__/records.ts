import type { EnrichmentRecord, EnrichmentResult } from "../types";

/** Shapes taken from the provider docs examples (docs/fullenrich.md). */
export const fullRecord: EnrichmentRecord = {
  input: {
    first_name: "Grégoire",
    last_name: "Démogé",
    company_domain: "fullenrich.com",
    company_name: "FullEnrich",
    professional_network_url: "https://www.linkedin.com/in/demoge/",
  },
  custom: { contact_id: "c-1", list_id: "l-1", batch_id: "b-1" },
  contact_info: {
    most_probable_work_email: { email: "gregoire@fullenrich.com", status: "DELIVERABLE" },
    most_probable_personal_email: { email: "greg@gmail.com", status: "HIGH_PROBABILITY" },
    most_probable_phone: { number: "+33 6 12 34 56 78", region: "FR", line_type: "MOBILE", line_status: "ACTIVE", connect_rate: "HIGH" },
    work_emails: [{ email: "gregoire@fullenrich.com", status: "DELIVERABLE" }],
    personal_emails: [{ email: "greg@gmail.com", status: "HIGH_PROBABILITY" }],
    phones: [
      { number: "+33 6 12 34 56 78", region: "FR", line_type: "MOBILE" },
      { number: "+33 1 00 00 00 00", region: "FR", line_type: "LANDLINE" },
    ],
  },
  profile: {
    full_name: "Grégoire Démogé",
    headline: "Co-founder at FullEnrich",
    location: { city: "Paris", region: "Île-de-France", country: "France", country_code: "FR" },
    social_profiles: { professional_network: { url: "https://www.linkedin.com/in/demoge/", handle: "demoge" } },
    employment: {
      current: {
        title: "Co-founder & CEO",
        company: { name: "FullEnrich", domain: "fullenrich.com", logo_url: "https://logo.test/fe.png", industry: { main_industry: "Software" } },
      },
    },
  },
};

export const catchAllRecord: EnrichmentRecord = {
  input: { first_name: "Jane", last_name: "Doe", company_domain: "example.com" },
  custom: { contact_id: "c-2", list_id: "l-1", batch_id: "b-1" },
  contact_info: {
    most_probable_work_email: { email: "jane@example.com", status: "CATCH_ALL" },
    most_probable_personal_email: null,
    most_probable_phone: { number: "+1 555 000 0000", region: "US", line_type: "LANDLINE" },
    work_emails: [{ email: "jane@example.com", status: "CATCH_ALL" }],
    personal_emails: [],
    phones: [{ number: "+1 555 000 0000", region: "US", line_type: "LANDLINE" }],
  },
};

export const invalidRecord: EnrichmentRecord = {
  input: { first_name: "No", last_name: "Body", company_domain: "nowhere.test" },
  custom: { contact_id: "c-3", list_id: "l-1", batch_id: "b-1" },
  contact_info: {
    most_probable_work_email: { email: "no@nowhere.test", status: "INVALID" },
    most_probable_personal_email: null,
    most_probable_phone: null,
    work_emails: [],
    personal_emails: [],
    phones: [],
  },
};

export const finishedResult: EnrichmentResult = {
  id: "enr-1",
  name: "list_l-1_batch_b-1",
  status: "FINISHED",
  cost: { credits: 15 },
  data: [fullRecord, catchAllRecord, invalidRecord],
};

export const contactEvent: EnrichmentResult = {
  id: "enr-1",
  name: "list_l-1_batch_b-1",
  status: "IN_PROGRESS",
  data: [fullRecord],
};
