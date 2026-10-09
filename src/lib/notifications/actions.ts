"use server";

import { createClient } from "@/utils/supabase/server";
import { getUser } from "@/lib/supabase/queries";
import { getNotifications, getUnreadCount } from "./queries";
import type { NotificationItem } from "./types";

/**
 * Bell actions. None of them revalidates a path: the dropdown owns its state
 * and nothing else on the page depends on it, so the layout is never
 * re-rendered for a read receipt.
 */
export interface NotificationFeed {
  items: NotificationItem[];
  unread: number;
}

export async function fetchNotifications(): Promise<NotificationFeed> {
  if (!(await getUser())) return { items: [], unread: 0 };
  const [items, unread] = await Promise.all([getNotifications(), getUnreadCount()]);
  return { items, unread };
}

/** Mark one notification read. Returns the new unread total. RLS limits the update to own rows. */
export async function markNotificationRead(id: string): Promise<number> {
  if (!(await getUser())) return 0;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
  return getUnreadCount();
}

export async function markAllNotificationsRead(): Promise<number> {
  if (!(await getUser())) return 0;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  return 0;
}
