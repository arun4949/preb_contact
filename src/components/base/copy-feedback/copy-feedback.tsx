"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RiCheckLine } from "@remixicon/react";
import { useToast } from "@/components/base/toast/toast";
import { cx } from "@/utils/cx";

/**
 * In-place copy confirmation, used by every copy control in the app: the
 * control shows a check and a small "Copied" bubble rises above it for a
 * moment, right where the user is looking. Only a failure falls back to a
 * toast. Screen readers get a polite live announcement.
 *
 *   const { copied, copy } = useCopyFeedback();
 *   <span className="relative inline-flex">
 *     <button onClick={() => copy(value)}>…</button>
 *     <CopiedBubble show={copied !== null} />
 *   </span>
 */

export const COPIED_MS = 1600;

/**
 * `copied` holds the key of the last successful copy (any string the caller
 * passes, "default" when none) until the confirmation times out, so one hook
 * can serve several copy actions that share one anchor (a row menu).
 */
export function useCopyFeedback(durationMs = COPIED_MS) {
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (value: string, key = "default") => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(key);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), durationMs);
        return true;
      } catch {
        toast.error("Could not copy. Select the text and copy it by hand.");
        return false;
      }
    },
    [durationMs, toast],
  );

  return { copied, copy };
}

/**
 * The bubble with a check mark. Render it inside a `relative` wrapper around
 * the control; it centres itself above. `label` defaults to "Copied".
 */
export function CopiedBubble({
  show,
  label = "Copied",
  className,
}: {
  show: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border border-border-button-default bg-background-primary-default py-0.5 ps-1 pe-1.5 text-caption-1-medium text-text-primary shadow-dropdown",
          "transition-[opacity,transform] duration-200 ease-out",
          show ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          className,
        )}
      >
        <RiCheckLine
          className="size-3.5 text-notification-success-foreground"
          aria-hidden
        />
        {label}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {show ? label : ""}
      </span>
    </>
  );
}
