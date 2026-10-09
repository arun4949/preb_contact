"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiNotificationLine } from "@remixicon/react";
import { iconButtonStyles } from "@/components/base/buttons/icon-button";
import { Dropdown, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { useToast } from "@/components/base/toast/toast";
import { NotificationCenter } from "@/components/application/notification-center/notification-center";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/actions";
import type { NotificationItem } from "@/lib/notifications/types";
import { createRealtimeClient } from "@/utils/supabase/realtime";
import { cx } from "@/utils/cx";

export interface NotificationsDropdownProps {
  userId: string;
  initial: NotificationItem[];
  initialUnread: number;
}

/** Inserts within this window are fetched once. */
const COALESCE_MS = 400;

/**
 * Header bell: unread badge + the notification center in a popover. State
 * lives here (no layout re-render for a read receipt): realtime INSERTs on
 * the user's rows trigger a refetch through a server action, a toast
 * announces what arrived, and the feed is refreshed again whenever the tab
 * becomes visible (which also syncs reads made in another tab).
 */
export function NotificationsDropdown({ userId, initial, initialUnread }: NotificationsDropdownProps) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const known = useRef(new Set(initial.map((i) => i.id)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markRead = (id: string) => {
    let wasUnread = false;
    setItems((current) =>
      current.map((i) => {
        if (i.id !== id || i.readAt !== null) return i;
        wasUnread = true;
        return { ...i, readAt: new Date().toISOString() };
      }),
    );
    if (wasUnread) setUnread((n) => Math.max(0, n - 1));
    startTransition(() => {
      void markNotificationRead(id).then((n) => setUnread(n));
    });
  };

  const openItem = (item: NotificationItem) => {
    markRead(item.id);
    setOpen(false);
    if (!item.href) return;
    if (item.href.startsWith("/")) router.push(item.href);
    else window.open(item.href, "_blank", "noopener,noreferrer");
  };

  const refresh = useCallback(
    async (announce: boolean) => {
      try {
        const feed = await fetchNotifications();
        const fresh = feed.items.filter((i) => !known.current.has(i.id) && i.readAt === null);
        for (const i of feed.items) known.current.add(i.id);
        setItems(feed.items);
        setUnread(feed.unread);
        if (announce && fresh.length > 0 && document.visibilityState === "visible") {
          if (fresh.length === 1) {
            const item = fresh[0];
            toast.show(item.status === "neutral" ? "information" : item.status, item.title, {
              description: item.body || undefined,
              actions: item.href ? [{ label: "View", variant: "secondary", onClick: () => openItem(item) }] : undefined,
            });
          } else {
            toast.info(`${fresh.length} new notifications`, {
              actions: [{ label: "Open", variant: "secondary", onClick: () => setOpen(true) }],
            });
          }
        }
      } catch {
        // Network blip: the next realtime event or tab focus retries.
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast],
  );

  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(true), COALESCE_MS);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    // The socket must carry the user's JWT before the channel joins, or RLS
    // hides the rows and inserts never arrive (see createRealtimeClient).
    void createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`notifications:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, scheduleRefresh)
        .subscribe((status) => {
          // Anything written between the server render and the socket opening.
          if (status === "SUBSCRIBED") void refresh(false);
        });
      cleanup = () => void supabase.removeChannel(channel);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current) clearTimeout(timer.current);
      cleanup?.();
    };
  }, [userId, refresh, scheduleRefresh]);

  const markAll = () => {
    const at = new Date().toISOString();
    setItems((current) => current.map((i) => (i.readAt === null ? { ...i, readAt: at } : i)));
    setUnread(0);
    startTransition(() => {
      void markAllNotificationsRead();
    });
  };

  const label = unread === 0 ? "Notifications" : `Notifications, ${unread} unread`;

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      {/* BoardUI Finance template bell: secondary icon button + red count dot (template-notification-center-menu). */}
      <span className="group relative inline-flex shrink-0">
        <DropdownTrigger aria-label={label} className={cx(iconButtonStyles.base, iconButtonStyles.size.medium)}>
          <RiNotificationLine className={iconButtonStyles.icon.medium} aria-hidden />
        </DropdownTrigger>
        {unread > 0 ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0.5 start-[18px] flex h-4 min-w-4 items-center justify-center rounded-full border-[1.5px] border-background-primary-default bg-foreground-icon-error px-[3px] group-hover:border-0 group-active:border-0"
          >
            <span className="text-center text-[10px] leading-4 font-bold tabular-nums text-white">{unread > 9 ? "9+" : unread}</span>
          </span>
        ) : null}
      </span>
      <DropdownPopover aria-label="Notifications" placement="bottom end" offset={8} className="w-[430px] max-w-[calc(100vw-32px)] p-0" dialogClassName="gap-0">
        <NotificationCenter notifications={items} onOpen={openItem} onMarkAllRead={markAll} />
      </DropdownPopover>
    </Dropdown>
  );
}
