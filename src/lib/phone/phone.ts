import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import { hasFlag } from "country-flag-icons";
import { COUNTRY_NAMES } from "./country-names";

/**
 * Phone helpers shared by the onboarding form, Settings › Profile and the
 * admin signups table. Numbers are stored as E.164 (`+4915112345678`) with
 * the ISO 3166-1 alpha-2 country the user picked. Client and server validate
 * with the same library so what the field accepts is what the action stores.
 */

export interface PhoneCountry {
  iso2: CountryCode;
  name: string;
  dial: string;
}

/** Mirrors the `profile_phones.phone` check constraint. */
export const E164_PATTERN = /^\+[1-9][0-9]{4,14}$/;

export const DEFAULT_COUNTRY: CountryCode = "US";

/** Every country libphonenumber knows that also ships a flag, sorted by English name. */
export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .filter((iso2) => hasFlag(iso2))
  .map((iso2) => ({ iso2, name: COUNTRY_NAMES[iso2] ?? iso2, dial: getCountryCallingCode(iso2) }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** Region of the first `accept-language` entry (`de-DE,de;q=0.9` → `DE`), or null. */
export function countryFromAcceptLanguage(header: string | null | undefined): string | null {
  const first = (header ?? "").split(",")[0]?.trim() ?? "";
  const region = first.split(";")[0]?.split("-")[1];
  return region && region.length === 2 ? region.toUpperCase() : null;
}

/** Narrows an arbitrary string (geo header, stored column) to a country we can render. */
export function toPhoneCountry(value: string | null | undefined, fallback: CountryCode = DEFAULT_COUNTRY): CountryCode {
  const upper = (value ?? "").trim().toUpperCase();
  return isSupportedCountry(upper) && hasFlag(upper) ? (upper as CountryCode) : fallback;
}

/**
 * Validates what the user typed (national digits, or a full `+…` number) for
 * the selected country and returns the E.164 form plus the number's real
 * country. Null for an empty or invalid input.
 */
export function normalizePhone(raw: string, country: string): { e164: string; country: CountryCode } | null {
  const text = raw.trim();
  if (!text) return null;
  const parsed = parsePhoneNumberFromString(text, toPhoneCountry(country));
  if (!parsed || !parsed.isValid()) return null;
  const e164 = parsed.number;
  if (!E164_PATTERN.test(e164)) return null;
  return { e164, country: parsed.country ?? toPhoneCountry(country) };
}

/** `+49 151 12345678` for display; falls back to the raw value. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** National format (`0151 12345678`) to show a stored number inside the input. */
export function formatPhoneNational(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatNational() ?? e164;
}

/**
 * Formats as the user types. A pasted `+…` number reveals its own country so
 * the selector can follow it.
 */
export function formatAsYouType(text: string, country: CountryCode): { text: string; detectedCountry: CountryCode | undefined } {
  // Feed digits only (plus a leading "+"): spaces the user types in odd places
  // would otherwise make the formatter give up and echo raw digits.
  const international = text.trim().startsWith("+");
  const digits = (international ? "+" : "") + text.replace(/\D/g, "");
  const typer = new AsYouType(country);
  const formatted = typer.input(digits);
  return { text: formatted, detectedCountry: international ? typer.getNumber()?.country : undefined };
}
