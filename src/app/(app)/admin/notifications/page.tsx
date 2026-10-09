import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth/work-email";
import { fetchAnnouncementHistory, fetchAnnouncementRecipients } from "@/lib/notifications/admin-actions";
import { getSessionContext } from "@/lib/supabase/queries";
import { AnnouncementsAdmin } from "./announcements-admin";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

/**
 * /admin/notifications: Preb admins (`ADMIN_EMAILS`) write announcements that
 * land in the notification bell of every user, selected users or whole
 * workspaces. Service-role reads across all workspaces; others get a 404.
 */
export default async function AdminNotificationsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");
  if (!isAdminEmail(session.email)) notFound();

  const [recipients, history] = await Promise.all([fetchAnnouncementRecipients(), fetchAnnouncementHistory()]);
  return <AnnouncementsAdmin recipients={recipients} history={history} />;
}
