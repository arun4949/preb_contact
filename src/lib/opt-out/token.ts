import { createHash, randomBytes } from "node:crypto";

/** Confirmation links stay valid this long. */
export const OPT_OUT_TOKEN_TTL_HOURS = 24;

/** Opt-out tokens: 32 random bytes (base64url) in the link, SHA-256 hex in the database. */
export function createOptOutToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashOptOutToken(token) };
}

export function hashOptOutToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Tokens are base64url of 32 bytes (43 chars); anything else is rejected before touching the database. */
export function looksLikeOptOutToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
