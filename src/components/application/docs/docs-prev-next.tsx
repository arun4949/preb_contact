import Link from "next/link";
import { RiArrowLeftLine, RiArrowRightLine } from "@remixicon/react";
import type { DocsArticleRef } from "@/lib/docs/types";
import { directionalIconClass } from "@/utils/directional-icon";
import { cx } from "@/utils/cx";

const CARD = "group flex flex-col gap-1 rounded-2xl border border-border-button-default bg-background-primary-default p-4 outline-none transition-colors duration-150 ease hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring";

export function DocsPrevNext({ prev, next }: { prev: DocsArticleRef | null; next: DocsArticleRef | null }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Previous and next article" className="grid gap-3 sm:grid-cols-2">
      {prev ? (
        <Link href={prev.href} className={CARD}>
          <span className="flex items-center gap-1 text-caption-1-regular text-text-tertiary">
            <RiArrowLeftLine className={cx("size-3.5", directionalIconClass(RiArrowLeftLine))} aria-hidden />
            Previous
          </span>
          <span className="text-body-medium text-text-primary">{prev.title}</span>
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {next ? (
        <Link href={next.href} className={cx(CARD, "items-end text-end")}>
          <span className="flex items-center gap-1 text-caption-1-regular text-text-tertiary">
            Next
            <RiArrowRightLine className={cx("size-3.5", directionalIconClass(RiArrowRightLine))} aria-hidden />
          </span>
          <span className="text-body-medium text-text-primary">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
