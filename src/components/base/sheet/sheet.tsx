"use client";

import type { ReactNode } from "react";
import {
  Dialog as AriaDialog,
  Heading as AriaHeading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  type ModalOverlayProps as AriaModalOverlayProps,
} from "react-aria-components";
import { CloseButton } from "@/components/base/buttons/close-button";
import { useDirection } from "@/components/foundations/direction/direction";
import { cx } from "@/utils/cx";

/**
 * Side drawer for narrow viewports (filter rail, secondary panels). Same
 * backdrop recipe as `Dialog`; the panel slides in from the inline-end edge
 * and mirrors automatically in RTL through logical positioning.
 */
export interface SheetProps extends Omit<AriaModalOverlayProps, "children" | "className"> {
  title: ReactNode;
  description?: ReactNode;
  /** Edge the sheet attaches to. `end` (default) is the trailing inline edge. */
  side?: "start" | "end";
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Sheet({
  title,
  description,
  side = "end",
  footer,
  children,
  className,
  isDismissable = true,
  ...props
}: SheetProps) {
  const direction = useDirection();
  return (
    <AriaModalOverlay
      isDismissable={isDismissable}
      {...props}
      className={({ isEntering, isExiting }) =>
        cx(
          "fixed inset-0 z-100 flex bg-black/70",
          side === "end" ? "justify-end" : "justify-start",
          isEntering && "animate-dialog-backdrop-in",
          isExiting && "animate-dialog-backdrop-out",
        )
      }
    >
      <AriaModal
        className={({ isEntering, isExiting }) =>
          cx(
            "h-full w-[min(360px,calc(100vw-40px))] transform-gpu will-change-transform",
            isEntering && (side === "end" ? "animate-sheet-in-end" : "animate-sheet-in-start"),
            isExiting && (side === "end" ? "animate-sheet-out-end" : "animate-sheet-out-start"),
          )
        }
      >
        <AriaDialog
          dir={direction}
          className={cx(
            "relative flex h-full flex-col bg-background-full shadow-xs outline-none",
            side === "end" ? "rounded-s-3xl" : "rounded-e-3xl",
            className,
          )}
        >
          {({ close }) => (
            <>
              <div className="flex flex-col gap-1 px-5 pt-5 pe-14">
                <AriaHeading slot="title" className="text-title-3-semibold text-text-primary">
                  {title}
                </AriaHeading>
                {description ? <p className="text-body-regular text-text-secondary">{description}</p> : null}
              </div>
              <CloseButton size="sm" aria-label="Close" onClick={close} className="absolute top-4 end-4" />
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
              {footer ? (
                <div className="flex items-center justify-end gap-2 border-t border-separator-border px-5 py-4">{footer}</div>
              ) : null}
            </>
          )}
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  );
}
