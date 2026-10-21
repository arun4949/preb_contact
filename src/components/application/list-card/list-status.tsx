import type { ListRow, ListStatus } from "@/lib/supabase/queries";

type ChipColor = "lime" | "blue" | "orange" | "rose" | "neutral" | "purple";

export const LIST_STATUS_META: Record<ListStatus, { label: string; chip: ChipColor; running: boolean }> = {
  draft: { label: "Draft", chip: "neutral", running: false },
  queued: { label: "Queued", chip: "blue", running: true },
  enriching: { label: "Enriching", chip: "blue", running: true },
  stopping: { label: "Stopping", chip: "orange", running: true },
  paused_credits: { label: "Paused, needs credits", chip: "orange", running: false },
  paused_upstream: { label: "Paused, provider issue", chip: "orange", running: false },
  stopped: { label: "Stopped", chip: "neutral", running: false },
  completed: { label: "Enriched", chip: "lime", running: false },
  failed: { label: "Failed", chip: "rose", running: false },
};

/** Status label with the pause reason spelled out (`lists.pause_reason`). */
export function listStatusLabel(list: Pick<ListRow, "status" | "pause_reason">): string {
  if (list.status !== "paused_credits") return LIST_STATUS_META[list.status].label;
  switch (list.pause_reason) {
    case "overspend_limit":
      return "Paused, overspend limit reached";
    case "overspend_payment":
      return "Paused, payment failed";
    default:
      return LIST_STATUS_META.paused_credits.label;
  }
}
