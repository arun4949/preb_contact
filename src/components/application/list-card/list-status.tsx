import type { ListStatus } from "@/lib/supabase/queries";

type ChipColor = "lime" | "blue" | "orange" | "rose" | "neutral" | "purple";

export const LIST_STATUS_META: Record<ListStatus, { label: string; chip: ChipColor; running: boolean }> = {
  draft: { label: "Draft", chip: "neutral", running: false },
  queued: { label: "Queued", chip: "blue", running: true },
  enriching: { label: "Enriching", chip: "blue", running: true },
  stopping: { label: "Stopping", chip: "orange", running: true },
  paused_credits: { label: "Paused — needs credits", chip: "orange", running: false },
  paused_upstream: { label: "Paused — provider issue", chip: "orange", running: false },
  stopped: { label: "Stopped", chip: "neutral", running: false },
  completed: { label: "Enriched", chip: "lime", running: false },
  failed: { label: "Failed", chip: "rose", running: false },
};
