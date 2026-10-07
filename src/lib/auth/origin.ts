import type { NextRequest } from "next/server";

/**
 * Origin to redirect to after an auth round-trip. `request.nextUrl.origin`
 * is wrong behind the dev tunnel (cloudflared forwards https → localhost, so
 * Next reconstructs `https://localhost:3000`). Trust the forwarded host only
 * when it is the configured app host; localhost is always plain http.
 */
export function redirectOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || hostname === "127.0.0.1") return `http://${host}`;
  if (configured && new URL(configured).host === host) return configured;
  return request.nextUrl.origin;
}
