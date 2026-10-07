import { createHash, randomBytes } from "node:crypto";

/** Invite tokens: 32 random bytes (base64url) in the link, SHA-256 hex in the database. */
export function createInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
