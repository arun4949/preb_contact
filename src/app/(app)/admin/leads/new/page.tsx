import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/work-email";
import { fetchAdminProfiles } from "@/lib/leads/admin-actions";
import { getSessionContext } from "@/lib/supabase/queries";
import { NewLeadForm } from "./new-lead-form";

export const metadata: Metadata = { title: "New lead enrichment" };
export const dynamic = "force-dynamic";

/** /admin/leads/new: create a sample enrichment for a prospect and get the share link and code. */
export default async function NewLeadPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();
  const owners = await fetchAdminProfiles();
  return <NewLeadForm owners={owners} meId={session.userId} />;
}
