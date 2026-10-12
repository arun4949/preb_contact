import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { countryFromAcceptLanguage, toPhoneCountry } from "@/lib/phone/phone";
import { getProfile, getProfilePhone, getSessionContext } from "@/lib/supabase/queries";
import { suggestWorkspaceName } from "@/lib/workspace/naming";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

/**
 * First-login screen (name + workspace name). Also the landing spot for a
 * signed-in user without any workspace (removed from their only one): they
 * create a fresh workspace here instead of bouncing between /login and /lists.
 * Lives outside the app shell because the shell needs a workspace to render.
 */
export default async function OnboardingPage() {
  const [session, phone, h] = await Promise.all([getSessionContext(), getProfilePhone(), headers()]);
  // Country selector default: Vercel's geo header, else the browser locale, else US.
  const defaultCountry = toPhoneCountry(h.get("x-vercel-ip-country") ?? countryFromAcceptLanguage(h.get("accept-language")));

  if (session) {
    if (session.profile.onboarded_at || session.role !== "owner") redirect("/lists");
    return (
      <OnboardingForm
        mode="first_login"
        defaultName={session.profile.full_name ?? ""}
        defaultWorkspace={session.workspace.name}
        defaultPhone={phone?.phone ?? null}
        defaultCountry={phone?.country ?? defaultCountry}
      />
    );
  }

  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <OnboardingForm
      mode="no_workspace"
      defaultName={profile.full_name ?? ""}
      defaultWorkspace={suggestWorkspaceName(profile.email, profile.full_name)}
      defaultPhone={phone?.phone ?? null}
      defaultCountry={phone?.country ?? defaultCountry}
    />
  );
}
