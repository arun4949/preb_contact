import { randomInt } from "node:crypto";

/**
 * Referral codes: 8 characters from an alphabet without 0/O, 1/I and L, so a
 * code can be read out loud or typed from a screenshot. 31^8 is about 2^40,
 * which makes guessing a live code impractical; uniqueness is enforced by
 * the database.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
// The database check (migration 0031) is the looser `[A-HJ-NP-Z2-9]`; the generator never emits L either way.
const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;

export function generateReferralCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return out;
}

/** Upper-cases and strips separators; null when the result is not a well-formed code. */
export function normalizeCode(input: string | null | undefined): string | null {
  if (!input) return null;
  const code = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return CODE_RE.test(code) ? code : null;
}

/** `john.doe@acme.com` becomes `j***@acme.com`: the only form a referrer ever sees. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
