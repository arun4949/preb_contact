import { after, NextResponse, type NextRequest } from "next/server";
import { normalizeCode } from "@/lib/referrals/code";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } from "@/lib/referrals/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/opt-out/turnstile";
import { isThrottled, throttleKey } from "@/lib/opt-out/throttle";

/**
 * The landing page's Sign up / Sign in buttons go through here: a 30-day
 * `preb_ref` cookie attributes a later signup to this code (read server-side
 * at account creation), the click is counted, then the visitor lands on
 * /login. Unknown or revoked codes set nothing and still go to /login, so the
 * response never reveals whether a code exists.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const login = new URL("/login", request.nextUrl.origin);
  const response = NextResponse.redirect(login, 303);
  const code = normalizeCode(raw);
  if (!code) return response;
  if (isThrottled(throttleKey(clientIp(request.headers), request.headers.get("user-agent")), Date.now(), { windowMs: 60_000, max: 30 })) return response;

  const admin = createAdminClient();
  const { data: ref } = await admin.from("referral_codes").select("id, revoked_at, workspace:workspaces(kind)").eq("code", code).maybeSingle();
  if (!ref || ref.revoked_at || ref.workspace?.kind !== "customer") return response;

  const secure = process.env.NODE_ENV === "production";
  const already = request.cookies.get(REFERRAL_COOKIE)?.value === code;
  response.cookies.set(REFERRAL_COOKIE, code, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: REFERRAL_COOKIE_DAYS * 86_400 });
  // One click per browser: a repeat visit with the cookie already set does not count again.
  if (!already) {
    after(async () => {
      const { data } = await admin.from("referral_codes").select("click_count").eq("id", ref.id).maybeSingle();
      await admin
        .from("referral_codes")
        .update({ click_count: (data?.click_count ?? 0) + 1 })
        .eq("id", ref.id);
    });
  }
  return response;
}
