"use client";

import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { CopiedBubble, useCopyFeedback } from "@/components/base/copy-feedback/copy-feedback";

/** A value with a small copy button next to it (email address, ids). Left to right always. */
export function CopyValue({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopyFeedback();
  const Icon = copied ? RiCheckLine : RiFileCopyLine;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate" dir="ltr">
        {value}
      </span>
      <span className="relative inline-flex shrink-0">
        <button
          type="button"
          aria-label={label}
          onClick={() => copy(value)}
          className="inline-flex size-6 items-center justify-center rounded-md text-foreground-icon-tertiary outline-none transition-colors hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <Icon className="size-4" aria-hidden />
        </button>
        <CopiedBubble show={copied !== null} />
      </span>
    </span>
  );
}
