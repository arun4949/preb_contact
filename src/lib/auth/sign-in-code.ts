/**
 * The one-time sign-in code Supabase mints next to the magic-link token. Its
 * length is a project setting (Authentication › Email › OTP length, 6 to 10
 * digits), so nothing here hardcodes it: the action tells the card how many
 * digits the email carries, and the email groups the digits for reading.
 */

/** Supabase allows 6 to 10 digits. */
export const SIGN_IN_CODE_MIN = 6;
export const SIGN_IN_CODE_MAX = 10;
/** Used before the actual length is known (the card's initial render). */
export const SIGN_IN_CODE_DEFAULT_LENGTH = 8;

export function isSignInCode(value: string): boolean {
  return new RegExp(`^[0-9]{${SIGN_IN_CODE_MIN},${SIGN_IN_CODE_MAX}}$`).test(value);
}

/** Digits per visual group: halves for even lengths ("8151 9179"), threes otherwise ("815 191 7"). */
export function signInCodeGroup(length: number): number {
  return length % 2 === 0 ? length / 2 : 3;
}

/** "81519179" → "8151 9179"; "815191" → "815 191". */
export function formatSignInCode(code: string): string {
  const group = signInCodeGroup(code.length);
  const parts: string[] = [];
  for (let i = 0; i < code.length; i += group) parts.push(code.slice(i, i + group));
  return parts.join(" ");
}
