import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signupSourceOrder } from "@/lib/onboarding/signup-source";
import { hasFreshPendingSignupSource } from "@/lib/onboarding/signup-source-store";
import { nextOnboardingPathFor } from "@/lib/onboarding/steps-store";
import { getUser } from "@/lib/supabase/queries";
import { SourceForm } from "./source-form";

export const metadata: Metadata = { title: "How you found us" };

/**
 * Optional second onboarding step for a new workspace owner: "How did you
 * first hear about Preb?". Shown once, right after the workspace card, and
 * only while the person's `signup_sources` row is pending and fresh. Everyone
 * else (existing accounts, invited teammates, a later visit, an answer already
 * given) moves on to the next open step or the app, so this page can never
 * trap anyone.
 */
export default async function SignupSourcePage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!(await hasFreshPendingSignupSource(user.id))) redirect(await nextOnboardingPathFor(user.id));
  return <SourceForm order={signupSourceOrder(user.id)} />;
}
