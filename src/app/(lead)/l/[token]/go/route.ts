import { NextResponse, type NextRequest } from "next/server";
import { PREFILL_EMAIL_COOKIE } from "@/lib/auth/prefill-email";
import { LEAD_REF_COOKIE, LEAD_REF_DAYS, type LeadCtaIntent } from "@/lib/leads/constants";
import { logShareEvent, touchShare } from "@/lib/leads/events";
import { hashShareToken, looksLikeShareToken } from "@/lib/leads/token";
import { createAdminClient } from "@/lib/supabase/admin";

const INTENTS: Record<string, LeadCtaIntent> = { signin: "signin", signup: "signup", offer: "offer" };

/**
 * The Sign in / Sign up buttons and the popup CTA go through here: the click
 * is logged, a 30-day `preb_lead_ref` cookie attributes a later signup to
 * this share, the lead's email (when the admin entered it) prefills the
 * sign-in form, then the visitor lands on /login.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const intent = INTENTS[request.nextUrl.searchParams.get("intent") ?? ""] ?? "signin";
  const login = new URL("/login", request.nextUrl.origin);
  const response = NextResponse.redirect(login, 303);
  if (!looksLikeShareToken(token)) return response;

  const admin = createAdminClient();
  const { data: share } = await admin.from("lead_shares").select("id, lead_email, revoked_at").eq("token_hash", hashShareToken(token)).maybeSingle();
  if (!share) return response;

  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(LEAD_REF_COOKIE, share.id, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: LEAD_REF_DAYS * 86_400 });
  if (share.lead_email) {
    // Same cookie the preb.co hero form uses; the login page reads and clears it.
    response.cookies.set(PREFILL_EMAIL_COOKIE, share.lead_email, { sameSite: "lax", secure, path: "/", maxAge: 10 * 60 });
  }
  await touchShare(admin, share.id);
  await logShareEvent(admin, share.id, intent === "offer" ? "cta_offer" : intent === "signup" ? "cta_signup" : "cta_signin");
  return response;
}
