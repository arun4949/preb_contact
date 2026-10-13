import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/work-email";
import { fetchOptOutQueue, fetchSuppressions } from "@/lib/suppression/admin-actions";
import { getSessionContext } from "@/lib/supabase/queries";
import { SuppressionsAdmin } from "./suppressions-admin";

export const metadata: Metadata = { title: "Suppressions" };
export const dynamic = "force-dynamic";

/**
 * /admin/suppressions: the contact suppression list (privacy policy § 12).
 * Founders add the email, LinkedIn URL or phone number of a person who
 * objected; the app clears their stored data and never enriches them again.
 * Self-service requests from /opt-out land here too: the confirmed email is
 * suppressed at once, phone numbers and LinkedIn URLs wait for review.
 */
export default async function AdminSuppressionsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();
  const [entries, queue] = await Promise.all([fetchSuppressions(), fetchOptOutQueue()]);
  return <SuppressionsAdmin entries={entries} queue={queue} />;
}
