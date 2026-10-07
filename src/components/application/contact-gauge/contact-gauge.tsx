"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCountUp } from "@/hooks/use-count-up";
import { cx } from "@/utils/cx";

export interface ContactGaugeProps {
  /** Total contacts in the list (centre number). */
  total: number;
  /** Rows with a valid email → `chart-1` arc. */
  valid: number;
  /** Rows with a risky (catch-all) email → `chart-3` arc, drawn after valid. */
  risky: number;
  /** Progress sweep for lists still enriching (0–1). When set, arcs animate to it. */
  label?: string;
  /** Loops a sweep across the track while enriching. */
  sweeping?: boolean;
  className?: string;
}

const W = 200;
const H = 112;
const R = 84;
const STROKE = 18;
const CX = W / 2;
const CY = H - 6;

/** 180° arc from left to right (physical coordinates — this is chart geometry). */
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

/**
 * Half-circle gauge for list cards: track on `border-button-default`,
 * valid emails on `chart-1`, risky on `chart-3`. Numbers count up.
 */
export function ContactGauge({ total, valid, risky, label = "Contacts", sweeping = false, className }: ContactGaugeProps) {
  const reduce = useReducedMotion();
  const display = useCountUp(total);
  const id = useId();
  const validFrac = total > 0 ? Math.min(1, valid / total) : 0;
  const riskyFrac = total > 0 ? Math.min(1 - validFrac, risky / total) : 0;
  const transition = reduce ? { duration: 0 } : { duration: 0.8, ease: [0.32, 0.72, 0, 1] as const };

  return (
    <div className={cx("relative mx-auto w-[200px]", className)} role="img" aria-label={`${label}: ${total.toLocaleString("en-US")}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden>
        <path d={ARC} fill="none" stroke="var(--color-border-button-default)" strokeWidth={STROKE} strokeLinecap="round" />
        {/* Valid arc */}
        <motion.path
          d={ARC}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 1 - validFrac }}
          transition={transition}
        />
        {/* Risky arc, continuing after the valid one. */}
        {riskyFrac > 0 ? (
          <motion.path
            d={ARC}
            fill="none"
            stroke="var(--color-chart-3)"
            strokeWidth={STROKE}
            strokeLinecap="butt"
            pathLength={1}
            strokeDasharray={`${riskyFrac} 1`}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -validFrac }}
            transition={transition}
          />
        ) : null}
        {/* Enriching sweep: a short highlight that travels the track. */}
        {sweeping && !reduce ? (
          <motion.path
            key={id}
            d={ARC}
            fill="none"
            stroke="var(--color-chart-1)"
            strokeOpacity={0.45}
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.18 1"
            animate={{ strokeDashoffset: [1.18, -0.18] }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
          />
        ) : null}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-body-2-regular text-text-secondary">{label}</span>
        <span className="text-title-1-medium text-text-primary tabular-nums">{display.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
