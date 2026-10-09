/**
 * Shared, client-safe notification types. The DB stores `kind` and `status`
 * as text (checked in migration 0014); these unions mirror those checks.
 */
export const NOTIFICATION_KINDS = [
  "admin",
  "member_joined",
  "member_welcome",
  "member_left",
  "member_removed",
  "role_changed",
  "workspace_deleted",
  "list_finished",
  "list_stopped",
  "list_paused_credits",
  "list_paused_upstream",
  "list_failed",
  "credits_low",
  "credits_granted",
  "credits_expiring",
  "trial_ending",
  "plan_started",
  "plan_changed",
  "plan_cancel_scheduled",
  "plan_cancel_reverted",
  "plan_canceled",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationStatus = "neutral" | "information" | "success" | "error";
/** `announcement` = written by the Preb team; everything else is workspace activity. */
export type NotificationCategory = "activity" | "announcement";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string | null;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
}

export function categoryOf(kind: string): NotificationCategory {
  return kind === "admin" ? "announcement" : "activity";
}

export function isNotificationKind(value: string): value is NotificationKind {
  return (NOTIFICATION_KINDS as readonly string[]).includes(value);
}

export function isNotificationStatus(value: string): value is NotificationStatus {
  return value === "neutral" || value === "information" || value === "success" || value === "error";
}
