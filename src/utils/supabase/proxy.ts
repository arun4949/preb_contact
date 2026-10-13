import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Paths that never require a session. Webhooks, cron and auth callbacks pass
 * through untouched. /terms and /privacy stay public so an old link 404s
 * instead of bouncing to login; the real pages live on preb.co (Framer). The
 * help center (/docs) is public and static, and so is the contact opt-out
 * form (/opt-out, privacy policy § 12) with its confirmation links. Exact
 * matches and prefixes are separate lists so "/docs" never opens "/docsomething".
 */
const PUBLIC_EXACT = ["/login", "/terms", "/privacy", "/robots.txt", "/sitemap.xml", "/docs", "/opt-out"];
const PUBLIC_PREFIXES = ["/auth/", "/invite/", "/api/webhooks/", "/api/jobs/", "/samples/", "/docs/", "/opt-out/"];

export function isPublic(pathname: string) {
  return PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Static pages that never read the session, so the proxy skips the token refresh. */
export function isSessionless(pathname: string) {
  return (
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/jobs/") ||
    pathname === "/docs" ||
    pathname.startsWith("/docs/") ||
    pathname === "/opt-out" ||
    pathname.startsWith("/opt-out/") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt"
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  // No session work at all for provider callbacks, cron, the public help center and the opt-out form.
  if (isSessionless(pathname)) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Don't put code between createServerClient and getClaims(): this call
  // refreshes an expired session and writes the new cookies via setAll.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/lists";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
