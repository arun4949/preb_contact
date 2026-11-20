import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasFreshPendingSignupAts } from "@/lib/onboarding/signup-ats-store";
import { nextOnboardingPathFor } from "@/lib/onboarding/steps-store";
import { getUser } from "@/lib/supabase/queries";
import { AtsForm } from "./ats-form";

export const metadata: Metadata = { title: "Your ATS" };

/**
 * Optional third onboarding step for a new workspace owner: "Which ATS do you
 * use?". Shown once, after the source question, and only while the person's
 * `signup_ats` row is pending and fresh. Everyone else (existing accounts,
 * invited teammates, a later visit, an answer already given) moves on to the
 * step that is still open or to the app, so this page can never trap anyone.
 */
export default async function SignupAtsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await hasFreshPendingSignupAts(user.id))) redirect(await nextOnboardingPathFor(user.id));
  return <AtsForm />;
}
