import { createHash } from "node:crypto";

/**
 * Best-effort throttle per server instance for anonymous writes (same idea as
 * the docs feedback votes). The key is a hash of ip + user agent and is never
 * stored; Turnstile and the per-address email cap are the real gates.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, { count: number; windowStart: number }>();

export function throttleKey(ip: string | null, userAgent: string | null): string {
  return createHash("sha256").update(`${ip ?? ""}|${userAgent ?? ""}`).digest("hex");
}

export function isThrottled(key: string, now = Date.now(), limits = { windowMs: WINDOW_MS, max: MAX_PER_WINDOW }): boolean {
  for (const [k, v] of hits) if (now - v.windowStart > limits.windowMs) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || now - entry.windowStart > limits.windowMs) {
    hits.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > limits.max;
}
