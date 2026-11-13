"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, sendEmail } from "@/lib/email/resend";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";
import { isAdminEmail, isFreeEmailDomain, WORK_EMAIL_MESSAGE } from "@/lib/auth/work-email";
import { sendMetaEvent } from "@/lib/meta/capi";
import { captureMetaClickContext } from "@/lib/meta/click-context";
import { finishInviteeSignup } from "@/lib/auth/first-login";
import { isThrottled, throttleKey } from "@/lib/opt-out/throttle";
import { isSignInCode } from "@/lib/auth/sign-in-code";
import { attributeReferralSignup, readReferralCookie } from "@/lib/referrals/attribution";

/**
 * Origin for auth redirects (magic link, OAuth return). Sign-in should return
 * the user to where they started, so the request origin wins — but only when
 * it is trusted (localhost or the configured app URL). Any other Host header
 * falls back to NEXT_PUBLIC_APP_URL, so a forged Host can't redirect a sign-in
 * link to a foreign domain. Webhooks/emails use NEXT_PUBLIC_APP_URL directly.
 */
export async function appOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const hostname = host.split(":")[0];
    const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
    const isConfigured = configured ? new URL(configured).host === host : false;
    if (isLocal || isConfigured) {
      const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
      return `${proto}://${host}`;
    }
  }
  return configured ?? "http://localhost:3000";
}

/** Only allow same-origin relative paths as post-login targets. */
function safeNext(next: unknown): string {
  if (typeof next !== "string") return "/lists";
  if (!next.startsWith("/") || next.startsWith("//")) return "/lists";
  return next;
}

export interface MagicLinkState {
  /** `verified` → the card performs a full navigation to `next` (see login-card.tsx). */
  status: "idle" | "sent" | "error" | "verified";
  email?: string;
  message?: string;
  /** Digits in the code the email carries (a Supabase project setting), set with `sent`. */
  codeLength?: number;
  /** Post-login target, set with `verified`. */
  next?: string;
}

/** Wrong codes per address before we stop checking for a while (best effort per instance; Supabase limits too). */
const CODE_ATTEMPT_LIMITS = { windowMs: 15 * 60 * 1000, max: 8 };

export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(formData.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  if (!(await isEmailAllowedToSignIn(email))) {
    return { status: "error", email, message: WORK_EMAIL_MESSAGE };
  }

  if (await isRateLimited(email, "magic_link")) {
    return { status: "error", email, message: "Too many sign-in links requested. Please wait an hour and try again." };
  }

  // Supabase Auth only mints the token (and creates the user on first sign-in);
  // the email itself is ours, rendered with react-email and sent via Resend.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    return { status: "error", email, message: "We couldn't create a sign-in link right now. Please try again." };
  }

  const origin = await appOrigin();
  // A first-time address gets a `signup` token, not a `magiclink` one; verifyOtp
  // rejects a mismatched type as "invalid or expired", so pass Supabase's own.
  const type = data.properties.verification_type ?? "magiclink";
  // Invite friends: the account was created just now, on the device that holds
  // the referral cookie. Attributing here (not on the confirm click) keeps the
  // referral when the link is opened on another device.
  if (type === "signup" && data.user) {
    const ref = await readReferralCookie();
    if (ref) await attributeReferralSignup(admin, data.user.id, ref, "magic_link");
    // Meta Ads: remember the click id while we are still in the browser that
    // clicked the ad (the link or code may be used in another one). Consent-gated.
    await captureMetaClickContext(admin, data.user.id, "magic_link");
  }
  const url = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}&next=${encodeURIComponent(next)}`;

  // The same token backs the link and the code: using one invalidates the
  // other. The code lets a phone user stay in the browser that opened the ad
  // (the Meta in-app browser would hand the link to Safari).
  const code = data.properties.email_otp;
  try {
    await sendEmail({ to: email, subject: "Your sign-in code for Preb", kind: "magic_link", react: MagicLinkEmail({ url, code }) });
  } catch (error) {
    console.error("[sendMagicLink] send failed", error instanceof Error ? error.message : error);
    return { status: "error", email, message: "We couldn't send the link right now. Please try again." };
  }
  // Meta: a first-time address is a Lead (server-only; the browser never learns
  // whether the email already had an account). Runs after the response, consent-gated.
  if (type === "signup") {
    const eventId = `lead:${data.properties.hashed_token.slice(0, 40)}`;
    // external_id = the new user's id, hashed like CompleteRegistration's, so Meta links the two.
    after(() => sendMetaEvent({ eventName: "Lead", eventId, userData: { email, externalId: data.user?.id ?? null } }));
  }
  return { status: "sent", email, codeLength: code.length };
}

/**
 * Signs in with the one-time code from the sign-in email, in the browser the
 * code is typed into. Supabase verifies the code against the token that
 * `sendMagicLink` created, so the usual rules apply: one hour, single use,
 * only the newest code. Everything that follows a link click (invitee
 * finish, redirect to `next`) happens here too, see auth/confirm/route.ts.
 */
export async function verifyEmailCode(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeNext(formData.get("next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  const sent: MagicLinkState = { status: "sent", email, codeLength: _prev.codeLength };
  if (!isSignInCode(code)) return { ...sent, message: "Enter the code from the email, digits only." };
  if (isThrottled(throttleKey(email, "code"), Date.now(), CODE_ATTEMPT_LIMITS)) {
    return { ...sent, message: "Too many attempts. Request a new code and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) {
    return { ...sent, message: "That code is not right. Check the digits or request a new code." };
  }
  await finishInviteeSignup(data.user.id);
  // No `redirect()`: the card lives under the (auth) layout and `next` under
  // the (app) layout; a cross-group server-action redirect looped on prod
  // (see onboarding/actions.ts). The card navigates with a full page load.
  return { status: "verified", email, next };
}

/**
 * Work-email policy: free-mail addresses may sign in only when they are an
 * admin, already have an account, or hold a workspace invite (invitees get no
 * trial, so there is nothing to farm).
 */
export async function isEmailAllowedToSignIn(email: string): Promise<boolean> {
  if (!isFreeEmailDomain(email) || isAdminEmail(email)) return true;
  const admin = createAdminClient();
  const [{ data: profile }, { data: invite }] = await Promise.all([
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
    admin.from("workspace_invites").select("id").ilike("email", email).gt("expires_at", new Date().toISOString()).limit(1).maybeSingle(),
  ]);
  return Boolean(profile || invite);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const origin = await appOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // After a rejected personal account Google would silently pick the same
      // account again (seen in the auth logs: up to five retries in a row), so
      // show the account chooser and let the person pick the work account.
      ...(formData.get("choose_account") === "1" ? { queryParams: { prompt: "select_account" } } : {}),
    },
  });
  if (error || !data.url) redirect(`/login?error=oauth&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
