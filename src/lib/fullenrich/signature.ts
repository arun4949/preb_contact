import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Webhook signature: `X-Signature-SHA1` = lowercase hex HMAC-SHA1 of the raw
 * body with our API key as the secret. Compare in constant time.
 */
export function signBody(rawBody: string, secret: string): string {
  return createHmac("sha1", secret).update(rawBody, "utf8").digest("hex");
}

export function verifySignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = signBody(rawBody, secret);
  const given = signature.trim().toLowerCase();
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(given, "utf8"));
}
