"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRateLimited, sendEmail } from "@/lib/email/resend";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";

/** Absolute app origin for redirects (env first, request host as fallback). */
export async function appOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
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

  if (await isRateLimited(email, "magic_link")) {
    return { status: "error", message: "Too many sign-in links requested. Please wait an hour and try again." };
  }

  // Supabase Auth only mints the token (and creates the user on first sign-in);
  // the email itself is ours, rendered with react-email and sent via Resend.
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    return { status: "error", message: "We couldn't create a sign-in link right now. Please try again." };
  }

  const origin = await appOrigin();
  const url = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=${encodeURIComponent(next)}`;

  try {
    await sendEmail({ to: email, subject: "Your sign-in link for Preb", kind: "magic_link", react: MagicLinkEmail({ url }) });
  } catch {
    return { status: "error", message: "We couldn't send the link right now. Please try again." };
  }
  return { status: "sent", email };
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
