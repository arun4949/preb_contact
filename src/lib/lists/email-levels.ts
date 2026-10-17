import type { EmailStatus, EnrichedPhone } from "@/lib/fullenrich/types";

/**
 * The three levels an email we show can have, plus the labels, explanations
 * and chart tokens the list page, the table markers, the CSV and the docs
 * share. Bounce figures come from the provider's published averages: valid
 * below 2%, probably valid around 9%, catch-all between 26% and 40%. Nothing
 * else is quantified, and the provider is never named.
 */
export type EmailLevel = "valid" | "probable" | "catch_all";

/** `null` for INVALID, INVALID_DOMAIN, unknown strings and missing statuses (never shown as a result). */
export function emailLevel(status: EmailStatus | string | null | undefined): EmailLevel | null {
  switch (status) {
    case "DELIVERABLE":
      return "valid";
    case "HIGH_PROBABILITY":
      return "probable";
    case "CATCH_ALL":
      return "catch_all";
    default:
      return null;
  }
}

export interface EmailLevelMeta {
  /** Short name used in chips, markers, the CSV status column and the docs. */
  label: string;
  /** Tooltip headline. */
  title: string;
  /** One or two sentences for the tooltip and the cards' hover panel. */
  description: string;
  /** "Estimated bounce rate" line, or the credit note for Not found. */
  bounce: string;
  /** Chart token (donut segment, chip swatch) and the matching text token (marker icon). */
  chart: string;
  text: string;
}

export const EMAIL_LEVEL_META: Record<EmailLevel | "not_found", EmailLevelMeta> = {
  valid: {
    label: "Valid",
    title: "Valid and safe to send",
    description: "The mailbox was confirmed and accepts email. These addresses reach the inbox.",
    bounce: "Estimated bounce rate below 2%",
    chart: "bg-chart-1",
    text: "text-chart-1-active",
  },
  probable: {
    label: "Probably valid",
    title: "Probably valid",
    description: "The domain accepts every address, but three independent checks found positive signals for this mailbox. Very likely to reach the inbox.",
    bounce: "Estimated bounce rate around 9%",
    chart: "bg-chart-2",
    text: "text-chart-2-active",
  },
  catch_all: {
    label: "Catch-all",
    title: "Catch-all domain",
    description: "The domain accepts every address, even for mailboxes that do not exist, so this one could not be confirmed. Send in small batches and watch your bounces.",
    bounce: "Estimated bounce rate between 26% and 40%",
    chart: "bg-chart-8",
    text: "text-chart-8-active",
  },
  not_found: {
    label: "Not found",
    title: "Not found",
    description: "No address with enough confidence for this person.",
    bounce: "No credit used",
    chart: "bg-chart-track",
    text: "text-text-tertiary",
  },
};

export const EMAIL_LEVELS: EmailLevel[] = ["valid", "probable", "catch_all"];

export type ConnectRate = NonNullable<EnrichedPhone["connect_rate"]>;

export const CONNECT_RATE_META: Record<ConnectRate | "unrated", { label: string; title: string; description: string; chart: string; text: string }> = {
  HIGHEST: {
    label: "Highest",
    title: "Highest connect rate",
    description: "Telecom data shows this line is active and used often. Expect well above the average pickup rate. Call this person first.",
    chart: "bg-chart-1",
    text: "text-chart-1-active",
  },
  HIGH: {
    label: "High",
    title: "High connect rate",
    description: "Telecom data shows this line is active. Expect an above average pickup rate.",
    chart: "bg-chart-2",
    text: "text-chart-2-active",
  },
  MEDIUM: {
    label: "Medium",
    title: "Medium connect rate",
    description: "The line is active, but it was seen in use less recently. Expect an average pickup rate.",
    chart: "bg-chart-8",
    text: "text-chart-8-active",
  },
  unrated: {
    label: "Not rated",
    title: "No connect rate signal",
    description: "Connect rates are only measured for active mobile numbers in the US and Canada.",
    chart: "bg-chart-track",
    text: "text-text-tertiary",
  },
};

export type OwnershipMatch = NonNullable<EnrichedPhone["ownership_match"]>;

export const OWNERSHIP_META: Record<OwnershipMatch, { title: string; description: () => string; text: string }> = {
  CONFIRMED: {
    title: "Phone ownership confirmed",
    description: () => "Our primary verification confirmed this number belongs to your contact.",
    text: "text-chart-1-active",
  },
  MISMATCH: {
    title: "Ownership not confirmed",
    description: () => "The number was found for this person, but the ownership check did not match. Verify before you call.",
    text: "text-status-rose-text",
  },
};

export const LINE_TYPE_LABEL: Record<NonNullable<EnrichedPhone["line_type"]>, string> = {
  MOBILE: "Mobile",
  LANDLINE: "Landline",
  VOIP: "VoIP",
  UNKNOWN: "Unknown",
};

export const LINE_STATUS_LABEL: Record<NonNullable<EnrichedPhone["line_status"]>, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  UNKNOWN: "Unknown",
};
