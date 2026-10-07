"use client";

import { ProgressBar as AriaProgressBar, type ProgressBarProps as AriaProgressBarProps } from "react-aria-components";
import { cx } from "@/utils/cx";

export type ProgressBarTone = "accent" | "success" | "warning" | "error";

export interface ProgressBarProps extends Omit<AriaProgressBarProps, "className" | "children"> {
  /** Visible label above the track. */
  label?: string;
  /** Show the percentage at the end of the label row. */
  showValue?: boolean;
  tone?: ProgressBarTone;
  size?: "sm" | "md";
  className?: string;
}

const FILL: Record<ProgressBarTone, string> = {
  accent: "bg-accent-600",
  success: "bg-notification-success-foreground",
  warning: "bg-status-orange-text",
  error: "bg-notification-error-foreground",
};

/** Determinate bar: `bg-background-tertiary-default` track, animated fill. */
export function ProgressBar({ label, showValue = false, tone = "accent", size = "md", className, ...props }: ProgressBarProps) {
  return (
    <AriaProgressBar {...props} aria-label={props["aria-label"] ?? label} className={cx("flex w-full flex-col gap-1.5", className)}>
      {({ percentage, valueText }) => (
        <>
          {label || showValue ? (
            <div className="flex items-center justify-between gap-3">
              {label ? <span className="text-body-medium text-text-secondary">{label}</span> : <span />}
              {showValue ? <span className="text-body-2-regular text-text-tertiary tabular-nums">{valueText}</span> : null}
            </div>
          ) : null}
          <div className={cx("w-full overflow-hidden rounded-full bg-background-tertiary-default", size === "sm" ? "h-1.5" : "h-2")}>
            <div
              className={cx("h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none", FILL[tone])}
              style={{ width: `${Math.max(0, Math.min(100, percentage ?? 0))}%` }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}
