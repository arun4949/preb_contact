import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/work-email";
import { fetchAllReferrals } from "@/lib/referrals/admin-actions";
import { getSessionContext } from "@/lib/supabase/queries";
import { ReferralsAdmin } from "./referrals-admin";

export const metadata: Metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

/**
 * /admin/referrals: every signup through an invite link, including the ones
 * the rules rejected (fraud review), with the reward state and a way to take
 * an unused reward back. Admins only.
 */
export default async function AdminReferralsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();
  const referrals = await fetchAllReferrals();
  return <ReferralsAdmin referrals={referrals} />;
}
