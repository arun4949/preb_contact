"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, sendEmail } from "@/lib/email/resend";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";
import { isAdminEmail, isFreeEmailDomain, WORK_EMAIL_MESSAGE } from "@/lib/auth/work-email";

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
  status: "idle" | "sent" | "error";
  email?: string;
  message?: string;
}

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
  const url = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=${encodeURIComponent(next)}`;

  try {
    await sendEmail({ to: email, subject: "Your sign-in link for Preb", kind: "magic_link", react: MagicLinkEmail({ url }) });
  } catch (error) {
    console.error("[sendMagicLink] send failed", error instanceof Error ? error.message : error);
    return { status: "error", email, message: "We couldn't send the link right now. Please try again." };
  }
  return { status: "sent", email };
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
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?error=oauth&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
