/** Relative time and day grouping for the notification center (client and server safe). */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar days between `then` and `now` in the local timezone (0 = same day). */
export function daysBetween(then: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(then)) / DAY);
}

/** "now", "5m", "3h", "Yesterday", "Tue", "Oct 2", "Oct 2, 2025". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY && daysBetween(then, now) === 0) return `${Math.floor(diff / HOUR)}h`;
  const days = daysBetween(then, now);
  if (days === 1) return "Yesterday";
  const date = new Date(then);
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  if (date.getFullYear() === new Date(now).getFullYear()) return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type NotificationGroup = "Today" | "Yesterday" | "This week" | "Earlier";

export function groupOf(iso: string, now: number = Date.now()): NotificationGroup {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Earlier";
  const days = daysBetween(then, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}
