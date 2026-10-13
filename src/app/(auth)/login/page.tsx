import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PREFILL_EMAIL_COOKIE } from "@/lib/auth/prefill-email";
import { LoginCard } from "./login-card";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The hero form on preb.co (Framer) drops the visitor's email into a
 * short-lived `.preb.co` cookie before redirecting here, so the field is
 * already filled in. Only a plausible email is used.
 */
function readPrefillEmail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let email = raw;
  try {
    email = decodeURIComponent(raw);
  } catch {}
  email = email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return undefined;
  return email;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/lists";
  const error = typeof params.error === "string" ? params.error : undefined;
  const notice = typeof params.notice === "string" ? params.notice : undefined;
  const prefillEmail = readPrefillEmail((await cookies()).get(PREFILL_EMAIL_COOKIE)?.value);
  return <LoginCard next={next} error={error} notice={notice} prefillEmail={prefillEmail} />;
}
