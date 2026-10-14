import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { LEAD_CODE_LENGTH } from "./constants";

/** Share tokens: 32 random bytes (base64url) in the link, SHA-256 hex in the database. */
export function createShareToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashShareToken(token) };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Tokens are base64url of 32 bytes (43 chars); anything else is rejected before touching the database. */
export function looksLikeShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** The 4-digit access code, from the CSPRNG (leading zeros allowed). */
export function generateCode(): string {
  return String(randomInt(0, 10 ** LEAD_CODE_LENGTH)).padStart(LEAD_CODE_LENGTH, "0");
}

export function looksLikeCode(code: string): boolean {
  return new RegExp(`^[0-9]{${LEAD_CODE_LENGTH}}$`).test(code);
}

/** Constant-time comparison of two codes of equal length. */
export function codeMatches(input: string, expected: string): boolean {
  if (!looksLikeCode(input) || !looksLikeCode(expected)) return false;
  return timingSafeEqual(Buffer.from(input, "utf8"), Buffer.from(expected, "utf8"));
}
