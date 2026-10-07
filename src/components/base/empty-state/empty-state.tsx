import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: IconComponent;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons / links rendered under the copy. */
  actions?: ReactNode;
  /** `page` (default) centres within a tall area; `inline` is compact for panels and tables. */
  size?: "page" | "inline";
}

/** Designed empty state: icon circle, headline, supporting copy, actions. */
export function EmptyState({ icon: Icon, title, description, actions, size = "page", className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center text-center",
        size === "page" ? "gap-5 px-6 py-16" : "gap-3 px-4 py-8",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <span
          className={cx(
            "flex items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary",
            size === "page" ? "size-14" : "size-10",
          )}
        >
          <Icon className={size === "page" ? "size-7" : "size-5"} aria-hidden />
        </span>
      ) : null}
      <div className="flex max-w-[420px] flex-col gap-1.5">
        <h3 className={cx("text-text-primary", size === "page" ? "text-title-3-semibold" : "text-headline-medium")}>{title}</h3>
        {description ? <p className="text-body-regular text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
