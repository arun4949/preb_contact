"use server";

import { isAdminEmail } from "@/lib/auth/work-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import { log } from "@/lib/jobs/shared";
import { validateAnnouncement, type AnnouncementAudience, type AnnouncementInput } from "./announcement";

/**
 * Admin announcements (`/admin/notifications`). Every action re-checks the
 * `ADMIN_EMAILS` allow-list; data goes through the service role because an
 * announcement reaches users outside the admin's own workspace.
 */
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface RecipientUser {
  id: string;
  name: string;
  email: string;
  workspaceName: string | null;
}

export interface RecipientWorkspace {
  id: string;
  name: string;
  memberCount: number;
}

export interface AnnouncementRecipients {
  users: RecipientUser[];
  workspaces: RecipientWorkspace[];
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  href: string | null;
  audience: AnnouncementAudience;
  recipientCount: number;
  readCount: number;
  createdAt: string;
  createdBy: string;
}

async function requireAdmin() {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
  return session;
}

/** Every user and workspace, for the audience picker. */
export async function fetchAnnouncementRecipients(): Promise<AnnouncementRecipients> {
  await requireAdmin();
  const admin = createAdminClient();
  const [{ data: profiles }, { data: workspaces }, { data: members }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, default_workspace_id").order("email"),
    admin.from("workspaces").select("id, name").order("name"),
    admin.from("workspace_members").select("workspace_id, user_id"),
  ]);
  const wsName = new Map((workspaces ?? []).map((w) => [w.id, w.name]));
  const counts = new Map<string, number>();
  const firstWorkspace = new Map<string, string>();
  for (const m of members ?? []) {
    counts.set(m.workspace_id, (counts.get(m.workspace_id) ?? 0) + 1);
    if (!firstWorkspace.has(m.user_id)) firstWorkspace.set(m.user_id, m.workspace_id);
  }
  return {
    users: (profiles ?? []).map((p) => {
      const ws = p.default_workspace_id ?? firstWorkspace.get(p.id) ?? null;
      return { id: p.id, name: p.full_name?.trim() || p.email, email: p.email, workspaceName: ws ? (wsName.get(ws) ?? null) : null };
    }),
    workspaces: (workspaces ?? []).map((w) => ({ id: w.id, name: w.name, memberCount: counts.get(w.id) ?? 0 })),
  };
}

/** Create the announcement and fan it out to every recipient in one statement. */
export async function sendAnnouncement(input: AnnouncementInput): Promise<Result<{ id: string; recipients: number }>> {
  const session = await requireAdmin();
  const error = validateAnnouncement(input);
  if (error) return { ok: false, error };
  const admin = createAdminClient();
  const { data, error: rpcError } = await admin.rpc("send_admin_notification", {
    p_created_by: session.userId,
    p_title: input.title.trim(),
    p_body: input.body.trim(),
    p_href: input.href.trim(),
    p_audience: input.audience,
    p_target_ids: input.audience === "all" ? [] : [...new Set(input.targetIds)],
  });
  if (rpcError || !data?.[0]) return { ok: false, error: "The announcement could not be sent. Please try again." };
  const row = data[0];
  log("admin.announcement_sent", { id: row.id, audience: input.audience, recipients: row.recipient_count });
  return { ok: true, data: { id: row.id, recipients: row.recipient_count } };
}

/** Last announcements with recipient and read totals. */
export async function fetchAnnouncementHistory(limit: number = 50): Promise<AnnouncementRecord[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("admin_notifications")
    .select("id, title, body, href, audience, recipient_count, created_at, created_by")
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = rows ?? [];
  if (list.length === 0) return [];
  const ids = list.map((r) => r.id);
  const [{ data: reads }, { data: authors }] = await Promise.all([
    admin.from("notifications").select("admin_notification_id").in("admin_notification_id", ids).not("read_at", "is", null),
    admin.from("profiles").select("id, full_name, email").in("id", [...new Set(list.map((r) => r.created_by))]),
  ]);
  const readCount = new Map<string, number>();
  for (const r of reads ?? []) if (r.admin_notification_id) readCount.set(r.admin_notification_id, (readCount.get(r.admin_notification_id) ?? 0) + 1);
  const author = new Map((authors ?? []).map((a) => [a.id, a.full_name?.trim() || a.email]));
  return list.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    href: r.href,
    audience: (r.audience as AnnouncementAudience) ?? "all",
    recipientCount: r.recipient_count,
    readCount: readCount.get(r.id) ?? 0,
    createdAt: r.created_at,
    createdBy: author.get(r.created_by) ?? "Preb",
  }));
}
