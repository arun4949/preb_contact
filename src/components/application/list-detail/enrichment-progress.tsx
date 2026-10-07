"use client";

import { useId } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { cx } from "@/utils/cx";

/**
 * Controlled fork of BoardUI `AgentProgress` for the enriching view: the
 * parent decides how many steps are complete (derived from the list's
 * counters) instead of a demo timer. Same step-row recipe: dashed pending
 * circle, spinning ring on the active step, check + strike-through when done.
 */
export interface EnrichmentProgressProps {
  steps: readonly string[];
  /** Number of completed steps; the next one is active. */
  completedCount: number;
  /** Shows the active step as waiting rather than working (paused lists). */
  paused?: boolean;
  className?: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function ActiveLoader({ paused }: { paused: boolean }) {
  const reduce = useReducedMotion();
  return (
    <svg aria-hidden viewBox="0 0 14 14" className={cx("size-3.5 shrink-0", !paused && !reduce && "animate-spin [animation-duration:1.4s]")}>
      <circle cx="7" cy="7" r="5.75" fill="none" stroke="var(--color-border-button-default)" strokeWidth="1.5" />
      <circle
        cx="7"
        cy="7"
        r="5.75"
        fill="none"
        stroke="var(--color-agent-progress-ring)"
        strokeWidth="1.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={paused ? "0.5 0.5" : "0.3 0.7"}
      />
    </svg>
  );
}

function CompletedIcon() {
  return (
    <svg aria-hidden viewBox="0 0 14 14" className="size-[15px]">
      <circle cx="7" cy="7" r="7" fill="var(--color-background-quaternary-default)" />
      <path d="M4 7.5 5.646 9.146a.5.5 0 0 0 .708 0L10 5.5" fill="none" stroke="var(--color-foreground-icon-secondary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg aria-hidden viewBox="0 0 15 15" className="size-[15px]">
      <circle cx="7.5" cy="7.5" r="7" fill="none" stroke="var(--color-background-quaternary-default)" strokeDasharray="2 2" />
    </svg>
  );
}

function StepRow({ label, index, completedCount, stepCount, paused }: { label: string; index: number; completedCount: number; stepCount: number; paused: boolean }) {
  const complete = index < completedCount;
  const active = index === completedCount && completedCount < stepCount;
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3, ease: EASE }}
      className="h-8 w-full"
    >
      <motion.div
        animate={{ paddingInlineStart: active ? 9 : 4, paddingInlineEnd: active ? 13 : 4 }}
        transition={{ duration: 0.36, ease: EASE }}
        className="relative flex h-full w-full items-center gap-2 rounded-full"
      >
        {active ? (
          <motion.span
            layoutId="enrichment-active-step"
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full border border-border-button-default"
            transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.8 }}
          />
        ) : null}
        <span className="relative z-10 flex size-3.5 shrink-0 items-center justify-center">
          <AnimatePresence initial={false} mode="popLayout">
            {complete ? (
              <motion.span key="complete" initial={{ opacity: 0, scale: 0.72, rotate: -18 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.34, ease: EASE }} className="absolute inset-[-0.5px]">
                <CompletedIcon />
              </motion.span>
            ) : active ? (
              <motion.span key="active" initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.82 }} transition={{ duration: 0.25 }} className="absolute inset-0">
                <ActiveLoader paused={paused} />
              </motion.span>
            ) : (
              <motion.span key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-[-0.5px]">
                <PendingIcon />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className={cx("relative z-10 block min-w-0 flex-1 truncate text-body-medium leading-5 transition-colors duration-300", complete || !active ? "text-text-secondary" : "text-text-primary")}>
          {active && !paused ? <span className="agent-progress-loading-text inline-block">{label}</span> : label}
          <AnimatePresence>
            {complete ? (
              <motion.span
                aria-hidden
                className="absolute top-1/2 end-0 start-0 h-px origin-left bg-current rtl:origin-right"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 0.8 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{ duration: 0.38, ease: EASE }}
              />
            ) : null}
          </AnimatePresence>
        </span>
      </motion.div>
    </motion.div>
  );
}

export function EnrichmentProgress({ steps, completedCount, paused = false, className }: EnrichmentProgressProps) {
  const id = useId();
  const count = Math.max(0, Math.min(completedCount, steps.length));
  const remaining = steps.length - count;
  const status = remaining === 0 ? "All steps completed" : `${remaining} ${remaining === 1 ? "step" : "steps"} left`;
  return (
    <div className={cx("rounded-2xl border border-border-button-default bg-background-primary-default px-2.5 pt-3 pb-2.5 shadow-xs", className)} aria-live="polite">
      <p className="ps-1 text-body-medium text-text-secondary">{status}</p>
      <LayoutGroup id={id}>
        <div className="mt-2 flex flex-col gap-1.5">
          {steps.map((step, index) => (
            <StepRow key={step} label={step} index={index} completedCount={count} stepCount={steps.length} paused={paused} />
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
