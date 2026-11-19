import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { countryFromAcceptLanguage, toPhoneCountry } from "@/lib/phone/phone";
import { SIGNUP_SOURCE_PATH } from "@/lib/onboarding/signup-source";
import { hasFreshPendingSignupSource } from "@/lib/onboarding/signup-source-store";
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
    if (session.role !== "owner") redirect("/lists");
    if (session.profile.onboarded_at) {
      // A new owner who just finished this card still has the optional second step
      // open. The form navigates there itself; this covers the refresh Next runs
      // after the action (it clears cookies), so both land on the same page.
      redirect((await hasFreshPendingSignupSource(session.userId)) ? SIGNUP_SOURCE_PATH : "/lists");
    }
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
