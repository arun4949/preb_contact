import { RiClaudeFill, RiOpenaiFill, RiSparkling2Line } from "@remixicon/react";
import type { AssistantId } from "@/lib/mcp/clients";
import { cx } from "@/utils/cx";

/**
 * Square logo tile for an AI assistant (Integrations page, consent screen,
 * Enrich tab badge). Brand marks come from Remix Icon; the tile surface is a
 * semantic token so it follows dark mode.
 */
export function AssistantLogo({ id, size = "md", className }: { id: AssistantId; size?: "sm" | "md" | "lg"; className?: string }) {
  const Icon = id === "claude" ? RiClaudeFill : id === "chatgpt" ? RiOpenaiFill : RiSparkling2Line;
  const tile = size === "lg" ? "size-14 rounded-2xl" : size === "sm" ? "size-6 rounded-md" : "size-10 rounded-xl";
  const glyph = size === "lg" ? "size-7" : size === "sm" ? "size-3.5" : "size-5";
  const tone = id === "claude" ? "bg-status-orange-background text-status-orange-text" : id === "chatgpt" ? "bg-background-tertiary-default text-text-primary" : "bg-status-purple-background text-status-purple-text";
  return (
    <span className={cx("flex shrink-0 items-center justify-center", tile, tone, className)} aria-hidden>
      <Icon className={glyph} />
    </span>
  );
}
