import "server-only";

import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import type { Tables } from "@/lib/supabase/types";
import { categoryOf, isNotificationKind, isNotificationStatus, type NotificationItem } from "./types";

export const NOTIFICATIONS_PAGE = 30;

export function toItem(row: Pick<Tables<"notifications">, "id" | "kind" | "title" | "body" | "href" | "status" | "created_at" | "read_at">): NotificationItem {
  return {
    id: row.id,
    kind: isNotificationKind(row.kind) ? row.kind : "admin",
    category: categoryOf(row.kind),
    title: row.title,
    body: row.body,
    href: row.href,
    status: isNotificationStatus(row.status) ? row.status : "neutral",
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/** Newest notifications of the signed-in user (RLS scopes the rows). */
export const getNotifications = cache(async (limit: number = NOTIFICATIONS_PAGE): Promise<NotificationItem[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, href, status, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toItem);
});

/** Unread total (not capped by the page size). */
export const getUnreadCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
});
