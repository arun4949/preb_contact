import type { Metadata } from "next";
import { headers } from "next/headers";
import { countryFromAcceptLanguage, toPhoneCountry } from "@/lib/phone/phone";
import { OptOutForm } from "./opt-out-form";

export const metadata: Metadata = {
  title: "Ask Preb not to process your data",
  description: "Put your email address, phone number or LinkedIn profile on Preb's suppression list. Preb then deletes stored results about you and never looks you up again.",
};

/**
 * Public self-service opt-out for people whose details a recruiter enriched
 * (privacy policy § 12). Reached from preb.co/contact-opt-out. No session: the
 * email is verified by a one-time link, phone and LinkedIn wait for a founder.
 */
export default async function OptOutPage() {
  const h = await headers();
  const defaultCountry = toPhoneCountry(h.get("x-vercel-ip-country") ?? countryFromAcceptLanguage(h.get("accept-language")));
  return <OptOutForm siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""} defaultCountry={defaultCountry} />;
}
