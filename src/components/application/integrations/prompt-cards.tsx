"use client";

import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { CopiedBubble, useCopyFeedback } from "@/components/base/copy-feedback/copy-feedback";
import { cx } from "@/utils/cx";

export interface PromptExample {
  title: string;
  prompt: string;
}

/** Prompts a user can paste into their assistant. Clicking a card copies it. */
export function PromptCards({ prompts }: { prompts: PromptExample[] }) {
  const { copied, copy } = useCopyFeedback();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {prompts.map((p) => {
        const done = copied === p.title;
        return (
          <button
            key={p.title}
            type="button"
            onClick={() => void copy(p.prompt, p.title)}
            className={cx(
              "group/prompt relative flex flex-col gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-5 text-start outline-none transition-colors duration-150 ease",
              "hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
            )}
            aria-label={`Copy prompt: ${p.title}`}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="text-headline-medium text-text-primary">{p.title}</span>
              <span className="relative inline-flex shrink-0">
                <span className={cx("inline-flex size-6 items-center justify-center rounded-md", done ? "text-notification-success-foreground" : "text-foreground-icon-tertiary group-hover/prompt:text-foreground-icon-primary")} aria-hidden>
                  {done ? <RiCheckLine className="size-4" /> : <RiFileCopyLine className="size-4" />}
                </span>
                <CopiedBubble show={done} />
              </span>
            </span>
            <span className="rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">&ldquo;{p.prompt}&rdquo;</span>
          </button>
        );
      })}
    </div>
  );
}
