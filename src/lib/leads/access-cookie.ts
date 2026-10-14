import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { LEAD_ACCESS_COOKIE_PREFIX, LEAD_ACCESS_DAYS } from "./constants";

/**
 * After a correct code the gate sets one HttpOnly cookie per share:
 * `preb_lead_<shareId> = <expiresAtMs>.<hmac>`. The HMAC key is derived from
 * the service key with a fixed label, so no extra secret has to be deployed;
 * the cookie carries no secret itself and cannot be forged without the key.
 */
function key(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createHash("sha256").update(`preb-lead-access:${secret}`).digest();
}

export function leadCookieName(shareId: string) {
  return `${LEAD_ACCESS_COOKIE_PREFIX}${shareId.replace(/-/g, "")}`;
}

function sign(shareId: string, expiresAt: number): string {
  return createHmac("sha256", key()).update(`${shareId}|${expiresAt}`).digest("base64url");
}

export function signLeadAccess(shareId: string, now = Date.now()): { value: string; expiresAt: Date } {
  const expiresAt = now + LEAD_ACCESS_DAYS * 86_400_000;
  return { value: `${expiresAt}.${sign(shareId, expiresAt)}`, expiresAt: new Date(expiresAt) };
}

export function verifyLeadAccess(shareId: string, value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const expiresAt = Number(value.slice(0, dot));
  const mac = value.slice(dot + 1);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = sign(shareId, expiresAt);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
