import { RiCheckLine } from "@remixicon/react";
import { cx } from "@/utils/cx";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Index of the current step. Steps before it are done. */
  current: number;
  className?: string;
}

/** Wizard steps (Upload · Map · Configure) with done / current / upcoming states. */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cx("flex items-center gap-2", className)} aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={cx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-caption-1-semibold transition-colors duration-200",
                  done && "bg-accent-600 text-text-white",
                  active && "bg-background-primary-default text-text-primary ring-2 ring-accent-600",
                  !done && !active && "border border-border-button-default bg-background-primary-default text-text-tertiary",
                )}
              >
                {done ? <RiCheckLine className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cx(
                  "text-body-medium",
                  active ? "text-text-primary" : done ? "text-text-secondary" : "text-text-tertiary",
                  "hidden sm:inline",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cx("h-px w-8 rounded-full sm:w-12", index < current ? "bg-accent-600" : "bg-separator-border")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
