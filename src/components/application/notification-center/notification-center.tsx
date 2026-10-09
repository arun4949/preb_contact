"use client";

import { useMemo, useState, type ComponentType, type HTMLAttributes, type Ref } from "react";
import {
  RiBankCardLine,
  RiCheckboxCircleFill,
  RiCoinLine,
  RiErrorWarningFill,
  RiFileList3Line,
  RiInformationFill,
  RiMegaphoneLine,
  RiNotification3Fill,
  RiNotificationOffLine,
  RiTeamLine,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { ScrollFade } from "@/components/base/scroll-fade/scroll-fade";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Logo } from "@/components/foundations/brand/logo";
import type { NotificationItem, NotificationKind, NotificationStatus } from "@/lib/notifications/types";
import { groupOf, timeAgo, type NotificationGroup } from "@/lib/notifications/time";
import { cx, sortCx } from "@/utils/cx";

/**
 * Preb fork of the BoardUI notification center (installed via MCP, then
 * adapted): tabs All · Activity · Announcements, rows grouped by day and
 * clickable, read state owned by the caller (`readAt`), no outer surface
 * because the header dropdown already provides one.
 */
export type NotificationCenterTab = "all" | "activity" | "announcements";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export interface NotificationCenterProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  notifications: NotificationItem[];
  defaultTab?: NotificationCenterTab;
  tab?: NotificationCenterTab;
  onTabChange?: (tab: NotificationCenterTab) => void;
  /** Row click: the caller marks it read and follows `href`. */
  onOpen?: (item: NotificationItem) => void;
  onMarkAllRead?: () => void;
  title?: string;
  /** Reference time for relative timestamps (defaults to render time). */
  now?: number;
  ref?: Ref<HTMLDivElement>;
}

const STATUS_ICON: Record<NotificationStatus, IconComponent> = {
  neutral: RiNotification3Fill,
  information: RiInformationFill,
  success: RiCheckboxCircleFill,
  error: RiErrorWarningFill,
};

const KIND_ICON: Partial<Record<NotificationKind, IconComponent>> = {
  member_joined: RiTeamLine,
  member_welcome: RiTeamLine,
  member_left: RiTeamLine,
  member_removed: RiTeamLine,
  role_changed: RiTeamLine,
  workspace_deleted: RiTeamLine,
  list_finished: RiFileList3Line,
  list_stopped: RiFileList3Line,
  list_paused_upstream: RiFileList3Line,
  credits_low: RiCoinLine,
  credits_granted: RiCoinLine,
  credits_expiring: RiCoinLine,
  trial_ending: RiCoinLine,
  plan_started: RiBankCardLine,
  plan_changed: RiBankCardLine,
  plan_cancel_scheduled: RiBankCardLine,
  plan_cancel_reverted: RiBankCardLine,
  plan_canceled: RiBankCardLine,
};

const styles = sortCx({
  status: {
    neutral: "bg-background-tertiary-default text-text-secondary",
    information: "bg-notification-information-background text-notification-information-foreground",
    success: "bg-notification-success-background text-notification-success-foreground",
    error: "bg-notification-error-background text-notification-error-foreground",
  },
});

const TABS: { id: NotificationCenterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "activity", label: "Activity" },
  { id: "announcements", label: "Announcements" },
];

const GROUP_ORDER: NotificationGroup[] = ["Today", "Yesterday", "This week", "Earlier"];

const inTab = (item: NotificationItem, tab: NotificationCenterTab) =>
  tab === "all" || (tab === "activity" ? item.category === "activity" : item.category === "announcement");

/** Icon circle, or the Preb mark for announcements. */
export function NotificationVisual({ item, className }: { item: Pick<NotificationItem, "kind" | "status">; className?: string }) {
  if (item.kind === "admin") {
    return (
      <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-50 ring-1 ring-accent-100 ring-inset", className)}>
        <Logo size={22} />
      </span>
    );
  }
  const Icon = KIND_ICON[item.kind] ?? STATUS_ICON[item.status];
  return (
    <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-full", styles.status[item.status], className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export interface NotificationRowProps {
  item: NotificationItem;
  now?: number;
  /** Fixed time label instead of the relative time (previews, so server and client render alike). */
  timeLabel?: string;
  onOpen?: (item: NotificationItem) => void;
  className?: string;
}

/** One notification. A button when `onOpen` is given, static otherwise (previews). */
export function NotificationRow({ item, now, timeLabel, onOpen, className }: NotificationRowProps) {
  const unread = item.readAt === null;
  const content = (
    <>
      <NotificationVisual item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className={cx("min-w-0 text-text-primary", unread ? "text-body-medium" : "text-body-regular")}>{item.title}</span>
          <span className="flex shrink-0 items-center gap-2 pt-0.5">
            {timeLabel !== undefined ? (
              <span className="text-caption-1-medium whitespace-nowrap text-text-tertiary">{timeLabel}</span>
            ) : (
              <time dateTime={item.createdAt} className="text-caption-1-medium whitespace-nowrap text-text-tertiary">
                {timeAgo(item.createdAt, now)}
              </time>
            )}
            {unread ? <span className="size-2 rounded-full bg-accent-500" aria-label="Unread" /> : null}
          </span>
        </span>
        {item.body ? <span className="line-clamp-3 text-body-2-regular text-text-secondary">{item.body}</span> : null}
      </span>
    </>
  );
  const base = "flex w-full gap-3 rounded-notification-card bg-background-primary-default px-3 py-3 text-start";
  if (!onOpen) return <div className={cx(base, className)}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cx(base, "cursor-pointer outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring", className)}
    >
      {content}
    </button>
  );
}

function TabLabel({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {count > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 py-px text-caption-1-semibold text-white">{count > 99 ? "99+" : count}</span>
      ) : null}
    </span>
  );
}

export function NotificationCenter({
  notifications,
  defaultTab = "all",
  tab,
  onTabChange,
  onOpen,
  onMarkAllRead,
  title = "Notifications",
  now,
  className,
  ref,
  ...props
}: NotificationCenterProps) {
  const [internalTab, setInternalTab] = useState<NotificationCenterTab>(defaultTab);
  const activeTab = tab ?? internalTab;
  const setTab = (next: NotificationCenterTab) => {
    if (tab === undefined) setInternalTab(next);
    onTabChange?.(next);
  };

  const unreadCount = notifications.filter((item) => item.readAt === null).length;
  const unreadByTab = useMemo(
    () => ({
      all: unreadCount,
      activity: notifications.filter((item) => item.readAt === null && item.category === "activity").length,
      announcements: notifications.filter((item) => item.readAt === null && item.category === "announcement").length,
    }),
    [notifications, unreadCount],
  );

  const groups = useMemo(() => {
    const visible = notifications.filter((item) => inTab(item, activeTab));
    const byGroup = new Map<NotificationGroup, NotificationItem[]>();
    for (const item of visible) {
      const g = groupOf(item.createdAt, now);
      byGroup.set(g, [...(byGroup.get(g) ?? []), item]);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ label: g, items: byGroup.get(g)! }));
  }, [notifications, activeTab, now]);

  const empty = activeTab === "announcements" ? { title: "No announcements yet", hint: "News from the Preb team will appear here." } : { title: "You're all caught up", hint: "New activity will appear here when it arrives." };

  return (
    <section ref={ref} aria-label={title} className={cx("flex w-full flex-col", className)} {...props}>
      <div className="flex flex-col gap-3 p-4 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="text-title-3-medium text-text-primary">{title}</h2>
            <p className="text-body-2-regular text-text-secondary">{unreadCount === 0 ? "No unread notifications" : `${unreadCount} unread`}</p>
          </div>
          <Button variant="ghost" size="small" onClick={onMarkAllRead} disabled={unreadCount === 0 || !onMarkAllRead}>
            Mark all read
          </Button>
        </div>

        <SegmentedControl
          aria-label="Notification category"
          selectedKeys={[activeTab]}
          onSelectionChange={(keys) => {
            const next = [...(keys as Set<string>)][0] as NotificationCenterTab | undefined;
            if (next) setTab(next);
          }}
          className="flex w-full"
        >
          {TABS.map(({ id, label }) => (
            <SegmentedControlItem key={id} id={id} className="flex-1">
              <TabLabel label={label} count={unreadByTab[id]} />
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>

      <div className="p-1.5 pt-0">
        <div className="overflow-hidden rounded-2xl bg-background-secondary-default">
          <ScrollFade className="max-h-[min(516px,calc(100dvh-180px))] p-2" surfaceClassName="from-background-secondary-default">
            {groups.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-2xl bg-background-primary-default px-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary">
                  {activeTab === "announcements" ? <RiMegaphoneLine className="size-5" aria-hidden /> : <RiNotificationOffLine className="size-5" aria-hidden />}
                </span>
                <p className="text-body-medium text-text-primary">{empty.title}</p>
                <p className="max-w-64 text-body-2-regular text-text-secondary">{empty.hint}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <p className="px-2 pt-1 text-caption-1-semibold text-text-tertiary">{group.label}</p>
                    <div className="flex flex-col gap-1.5">
                      {group.items.map((item) => (
                        <NotificationRow key={item.id} item={item} now={now} onOpen={onOpen} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollFade>
        </div>
      </div>
    </section>
  );
}
