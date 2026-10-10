import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

/**
 * Paths that never require a session. Webhooks, cron and auth callbacks pass
 * through untouched. /terms and /privacy stay public so an old link 404s
 * instead of bouncing to login; the real pages live on preb.co (Framer).
 */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/invite/", "/api/webhooks/", "/api/jobs/", "/samples/", "/terms", "/privacy", "/robots.txt"];

export function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  // No session work at all for provider callbacks and cron.
  if (pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/jobs/")) {
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
