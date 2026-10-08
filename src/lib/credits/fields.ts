import type { EnrichmentField } from "@/lib/credits/estimate";

/** The three things Preb can find, as shown on the list wizard and the Enrich tab. */
export const FIELD_CARDS: { key: EnrichmentField; title: string; description: string }[] = [
  { key: "work_email", title: "Work email", description: "Verified business email" },
  { key: "personal_email", title: "Personal email", description: "Direct reach · recruiting use only" },
  { key: "mobile_phone", title: "Mobile phone", description: "Mobile numbers; landlines are free" },
];

export const FIELD_LABEL: Record<EnrichmentField, string> = {
  work_email: "work email",
  personal_email: "personal email",
  mobile_phone: "mobile phone",
};
