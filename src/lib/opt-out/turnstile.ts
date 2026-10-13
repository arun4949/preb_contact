import "server-only";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

let warnedMissingSecret = false;

/**
 * Server-side check of a Cloudflare Turnstile token (mandatory: the widget
 * alone proves nothing). Tokens live 5 minutes and validate once. Fails closed
 * when the secret is missing so a misconfigured deployment never accepts bots.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error("[turnstile] TURNSTILE_SECRET_KEY is not set; every check fails closed");
    }
    return false;
  }
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}

/** First hop of x-forwarded-for, or null. Used only for the Turnstile check and a hashed throttle key. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || null;
}
