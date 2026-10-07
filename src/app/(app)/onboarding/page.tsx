import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/queries";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (session.profile.onboarded_at || session.role !== "owner") redirect("/lists");

  return (
    <div className="flex flex-1 items-center justify-center py-10 animate-page-enter">
      <OnboardingForm
        defaultName={session.profile.full_name ?? ""}
        defaultWorkspace={session.workspace.name}
      />
    </div>
  );
}
