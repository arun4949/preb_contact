"use client";

import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { CopiedBubble, useCopyFeedback } from "@/components/base/copy-feedback/copy-feedback";
import { cx } from "@/utils/cx";

/** The MCP server address with a copy button: the one thing a user pastes into their assistant. */
export function ServerUrlField({ url, className }: { url: string; className?: string }) {
  const { copied, copy } = useCopyFeedback();
  const done = copied !== null;
  return (
    <div className={cx("flex w-full items-center gap-2 rounded-2lg border border-border-button-default bg-background-secondary-default p-1 ps-3", className)}>
      <code className="min-w-0 flex-1 truncate font-mono text-body-regular text-text-primary" dir="ltr" aria-label="Preb server address">
        {url}
      </code>
      <span className="relative inline-flex shrink-0">
        <Button size="small" leadingIcon={done ? RiCheckLine : RiFileCopyLine} onClick={() => void copy(url)} aria-label="Copy the server address">
          {done ? "Copied" : "Copy"}
        </Button>
        <CopiedBubble show={done} />
      </span>
    </div>
  );
}
