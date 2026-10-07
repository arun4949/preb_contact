import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/queries";
import { NewListWizard } from "@/components/application/new-list/new-list-wizard";

export const metadata: Metadata = { title: "New list" };

export default async function NewListPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!session.profile.onboarded_at && session.role === "owner") redirect("/onboarding");
  return <NewListWizard creditsAvailable={session.creditsAvailable} />;
}
