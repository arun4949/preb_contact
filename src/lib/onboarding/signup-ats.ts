/**
 * The optional third onboarding step: "Which ATS do you use?". Pure and shared
 * by the form, the server action and the admin pages.
 *
 * The option list lives here and nowhere else (the database only checks the
 * shape of a key), so options can be added or reworded without a migration.
 * Removing a key keeps old answers readable: admin labels fall back to the
 * stored key.
 *
 * Order: fixed, unlike the source question. Which ATS a team uses is a fact,
 * not a recollection, so the first place earns no extra picks, and a list
 * that never moves is quicker to scan. "No ATS" and "Other" come last.
 */

export interface SignupAtsOption {
  key: string;
  /** What the person reads in the dropdown. */
  label: string;
  /** Shorter name for admin tables and charts. */
  short?: string;
  /** Label of the optional follow-up line; null when there is nothing to add. */
  detailLabel: string | null;
  detailPlaceholder?: string;
}

export const SIGNUP_ATS_OPTIONS: readonly SignupAtsOption[] = [
  { key: "bullhorn", label: "Bullhorn", detailLabel: null },
  { key: "crelate", label: "Crelate", detailLabel: null },
  { key: "loxo", label: "Loxo", detailLabel: null },
  { key: "jobdiva", label: "JobDiva", detailLabel: null },
  { key: "ceipal", label: "Ceipal", detailLabel: null },
  { key: "recruit_crm", label: "Recruit CRM", detailLabel: null },
  { key: "greenhouse", label: "Greenhouse", detailLabel: null },
  { key: "ashby", label: "Ashby", detailLabel: null },
  { key: "none", label: "No ATS (spreadsheet or CRM)", short: "No ATS", detailLabel: null },
  { key: "other", label: "Other", detailLabel: "Which ATS?", detailPlaceholder: "For example, Workday" },
];

/** Answers that do not name one of the listed systems. */
export const SIGNUP_ATS_NONE = "none";
export const SIGNUP_ATS_OTHER = "other";

export const SIGNUP_ATS_DETAIL_MAX = 200;

const BY_KEY = new Map(SIGNUP_ATS_OPTIONS.map((option) => [option.key, option]));

export function signupAtsOption(key: string | null | undefined): SignupAtsOption | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

export interface SignupAtsAnswer {
  ats: string;
  detail: string | null;
}

/**
 * A submitted answer, or null when the key is not one of ours. The detail is
 * trimmed, collapsed to one line and capped; options without a follow-up
 * never store one.
 */
export function parseSignupAtsAnswer(ats: unknown, detail: unknown): SignupAtsAnswer | null {
  const option = typeof ats === "string" ? signupAtsOption(ats) : null;
  if (!option) return null;
  const text = typeof detail === "string" ? detail.replace(/\s+/g, " ").trim().slice(0, SIGNUP_ATS_DETAIL_MAX) : "";
  return { ats: option.key, detail: option.detailLabel && text ? text : null };
}

export const SIGNUP_ATS_PATH = "/onboarding/ats";
