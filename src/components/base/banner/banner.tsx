import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { RiAlertFill, RiCheckboxCircleFill, RiErrorWarningFill, RiInformationFill } from "@remixicon/react";
import { cx } from "@/utils/cx";

export type BannerTone = "info" | "success" | "warning" | "error";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: BannerTone;
  title?: ReactNode;
  icon?: IconComponent;
  /** Trailing actions (buttons / links). */
  actions?: ReactNode;
  children?: ReactNode;
}

const TONE: Record<BannerTone, { icon: IconComponent; wrap: string; icon_: string }> = {
  info: {
    icon: RiInformationFill,
    wrap: "border-border-button-default bg-background-secondary-default",
    icon_: "text-notification-information-foreground",
  },
  success: {
    icon: RiCheckboxCircleFill,
    wrap: "border-border-button-default bg-notification-success-background",
    icon_: "text-notification-success-foreground",
  },
  warning: {
    icon: RiAlertFill,
    wrap: "border-border-button-default bg-status-orange-background",
    icon_: "text-status-orange-text",
  },
  error: {
    icon: RiErrorWarningFill,
    wrap: "border-border-error-default bg-notification-error-background",
    icon_: "text-notification-error-foreground",
  },
};

/** Inline message block for forms and panels. */
export function Banner({ tone = "info", title, icon, actions, children, className, ...props }: BannerProps) {
  const t = TONE[tone];
  const Icon = icon ?? t.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex items-start gap-3 rounded-xl border px-4 py-3", t.wrap, className)}
      {...props}
    >
      <Icon className={cx("mt-0.5 size-5 shrink-0", t.icon_)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="text-body-medium text-text-primary">{title}</p> : null}
        {children ? <div className="text-body-regular text-text-secondary">{children}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
