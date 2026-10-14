import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/work-email";
import { fetchLeadShares } from "@/lib/leads/admin-actions";
import { getSessionContext } from "@/lib/supabase/queries";
import { LeadsAdmin } from "./leads-admin";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

/**
 * /admin/leads: the lead magnet funnel. Every sample enrichment created for a
 * prospect, with its share link, access code, owner and engagement. All
 * admins see every lead and can filter to their own. Lists live in the
 * internal "Preb outreach" workspace and are never charged credits.
 */
export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();
  const params = await searchParams;
  const highlight = typeof params.list === "string" ? params.list : null;
  const shares = await fetchLeadShares();
  return <LeadsAdmin shares={shares} meId={session.userId} highlightListId={highlight} />;
}
