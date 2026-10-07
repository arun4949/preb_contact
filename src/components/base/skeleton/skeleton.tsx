import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";

/**
 * Loading placeholders. Shimmer blocks on `bg-background-secondary-default`;
 * the shimmer stops under `prefers-reduced-motion` (see globals.css).
 */
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** `text` renders a line-height block, `circle` a round avatar slot. */
  shape?: "block" | "text" | "circle";
}

export function Skeleton({ shape = "block", className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cx(
        "skeleton-shimmer bg-background-secondary-default",
        shape === "block" && "rounded-lg",
        shape === "text" && "h-3.5 rounded-md",
        shape === "circle" && "rounded-full",
        className,
      )}
      {...props}
    />
  );
}

/** Several text lines with a shorter last line. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} shape="text" className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}

/** Card-shaped preset matching list cards. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx("flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5", className)}
    >
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-8" />
        <Skeleton shape="text" className="w-1/2" />
      </div>
      <Skeleton className="h-24 w-full" />
      <SkeletonText lines={3} />
      <Skeleton className="h-9 w-full rounded-2lg" />
    </div>
  );
}

/** Table rows preset. */
export function SkeletonRows({ rows = 5, columns = 5, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cx("flex flex-col", className)} aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border-table px-4 py-3 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} shape="text" className={c === 0 ? "w-40" : "flex-1"} />
          ))}
        </div>
      ))}
    </div>
  );
}
