"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Heading as AriaHeading,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  type ModalOverlayProps as AriaModalOverlayProps,
} from "react-aria-components";
import { Button, type ButtonProps } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { useDirection } from "@/components/foundations/direction/direction";
import { cx } from "@/utils/cx";

/**
 * Modal dialog built on React Aria (focus trap, scroll lock, Escape, outside
 * press) and styled after BoardUI's Settings Modal overlay: a 70% black
 * backdrop, a `rounded-3xl` panel on `bg-background-full`, and a
 * scale / opacity / blur enter–exit over 300 ms with the modal easing curve.
 *
 * `Dialog` is the shell. `ConfirmDialog` is the ready-made destructive /
 * confirm variant used for delete, stop and remove actions.
 */

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export type DialogSize = "sm" | "md" | "lg";

export interface DialogProps extends Omit<AriaModalOverlayProps, "children" | "className"> {
  /** Accessible name for the dialog; also rendered as the title unless `hideTitle`. */
  title: ReactNode;
  description?: ReactNode;
  /** Keep the title for screen readers only (when the body renders its own heading). */
  hideTitle?: boolean;
  size?: DialogSize;
  /** Footer slot, usually buttons aligned end. */
  footer?: ReactNode;
  /** Show the top-end close button. Defaults to true. */
  closable?: boolean;
  children?: ReactNode;
  className?: string;
}

const SIZE: Record<DialogSize, string> = {
  sm: "w-[400px]",
  md: "w-[480px]",
  lg: "w-[640px]",
};

export function Dialog({
  title,
  description,
  hideTitle = false,
  size = "md",
  footer,
  closable = true,
  children,
  className,
  isDismissable = true,
  ...props
}: DialogProps) {
  const direction = useDirection();
  return (
    <AriaModalOverlay
      isDismissable={isDismissable}
      {...props}
      className={({ isEntering, isExiting }) =>
        cx(
          "fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4",
          isEntering && "animate-dialog-backdrop-in",
          isExiting && "animate-dialog-backdrop-out",
        )
      }
    >
      <AriaModal
        className={({ isEntering, isExiting }) =>
          cx(
            "transform-gpu will-change-[opacity,transform,filter]",
            isEntering && "animate-dialog-panel-in",
            isExiting && "animate-dialog-panel-out",
          )
        }
      >
        <AriaDialog
          dir={direction}
          className={cx(
            "relative flex max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] flex-col overflow-clip rounded-3xl bg-background-full shadow-xs outline-none",
            SIZE[size],
            className,
          )}
        >
          {({ close }) => (
            <>
              <div className="flex flex-col gap-1.5 px-6 pt-6 pe-14">
                <AriaHeading slot="title" className={cx("text-title-3-semibold text-text-primary", hideTitle && "sr-only")}>
                  {title}
                </AriaHeading>
                {description ? <p className="text-body-regular text-text-secondary">{description}</p> : null}
              </div>
              {closable ? (
                <CloseButton size="sm" aria-label="Close dialog" onClick={close} className="absolute top-4 end-4" />
              ) : null}
              {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div> : <div className="h-5" />}
              {footer ? (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-separator-border px-6 py-4">
                  {footer}
                </div>
              ) : null}
            </>
          )}
        </AriaDialog>
      </AriaModal>
    </AriaModalOverlay>
  );
}

/** Pairs a trigger with a `Dialog` for uncontrolled usage. */
export const DialogTrigger = AriaDialogTrigger;

export interface ConfirmDialogProps extends Omit<DialogProps, "footer" | "children"> {
  icon?: IconComponent;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** `danger` (default) for destructive actions, `primary` otherwise. */
  tone?: "danger" | "primary";
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

export function ConfirmDialog({
  icon: Icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  isPending = false,
  onConfirm,
  children,
  size = "sm",
  ...props
}: ConfirmDialogProps) {
  const variant: ButtonProps["variant"] = tone === "danger" ? "danger" : "primary";
  return (
    <Dialog
      size={size}
      {...props}
      footer={
        <>
          <Button variant="secondary" onClick={() => props.onOpenChange?.(false)} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={() => void onConfirm()} disabled={isPending} aria-busy={isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {Icon || children ? (
        <div className="flex gap-3">
          {Icon ? (
            <span
              className={cx(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                tone === "danger"
                  ? "bg-notification-error-background text-notification-error-foreground"
                  : "bg-notification-information-background text-notification-information-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          {children ? <div className="text-body-regular text-text-secondary">{children}</div> : null}
        </div>
      ) : null}
    </Dialog>
  );
}
