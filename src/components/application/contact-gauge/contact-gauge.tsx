"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useCountUp } from "@/hooks/use-count-up";
import { cx } from "@/utils/cx";
import { capFraction, dashFor, layoutSegments, type Segment } from "./geometry";

/** The three outcomes a work email can have; `none` is the grey remainder. */
export type GaugeKey = "valid" | "catch_all" | "none";

export interface ContactGaugeProps {
  /** Total contacts in the list (centre number at rest). */
  total: number;
  /** Denominator for the shares: enrichable rows, the same base as the percent chips. */
  base: number;
  /** Rows with a valid email (`chart-1` segment). */
  valid: number;
  /** Rows with a catch-all email (`chart-8` segment, drawn after valid). */
  catchAll: number;
  /** Focused outcome: the centre names it and the other segments dim. */
  active?: GaugeKey | null;
  /** Hovering a segment reports it here so the rows below can follow. */
  onActiveChange?: (key: GaugeKey | null) => void;
  /** Centre caption at rest. */
  label?: string;
  /** Loops a sweep across the track while enriching. */
  sweeping?: boolean;
  className?: string;
}

const W = 200;
const R = 84;
const STROKE = 16;
const CX = W / 2;
/** Arc base line: top headroom + radius + half the stroke. */
const CY = 4 + R + STROKE / 2;
/** Room for the round caps (half the stroke below the base line) plus a hairline. */
const H = CY + STROKE / 2 + 2;
/** Visual gap between two segments: 3° of the 180° arc (the BoardUI half-gauge padding). */
const GAP = 3 / 180;
const CAP = capFraction(STROKE, R);
/** Wider invisible stroke so a segment is easy to hover. */
const HIT_STROKE = STROKE + 12;

/** 180° arc from left to right (physical coordinates: this is chart geometry). */
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

const COLOR: Record<Exclude<GaugeKey, "none">, { fill: string; active: string }> = {
  valid: { fill: "var(--color-chart-1)", active: "var(--color-chart-1-active)" },
  catch_all: { fill: "var(--color-chart-8)", active: "var(--color-chart-8-active)" },
};

const CAPTION: Record<GaugeKey, string> = {
  valid: "Valid emails",
  catch_all: "Catch-all emails",
  none: "No email found",
};

const fmt = (n: number) => n.toLocaleString("en-US");
const pctOf = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

/**
 * Segmented half gauge for list cards: one ring answering one question, the
 * work-email outcome per enrichable contact. Valid on `chart-1`, catch-all on
 * `chart-8`, the remainder is the `chart-track` track. Segments have round
 * ends and a 3° gap; hovering one (or the remainder) swaps the centre to its
 * count and share, the BoardUI stacked-gauge recipe.
 */
export function ContactGauge({
  total,
  base,
  valid,
  catchAll,
  active = null,
  onActiveChange,
  label = "Contacts",
  sweeping = false,
  className,
}: ContactGaugeProps) {
  const reduce = useReducedMotion();
  const id = useId();

  const safeBase = Math.max(0, base);
  const validCount = Math.max(0, Math.min(valid, safeBase));
  const catchAllCount = Math.max(0, Math.min(catchAll, safeBase - validCount));
  const noneCount = Math.max(0, safeBase - validCount - catchAllCount);
  const counts: Record<GaugeKey, number> = { valid: validCount, catch_all: catchAllCount, none: noneCount };

  const segments = layoutSegments(
    [
      { key: "valid", value: safeBase > 0 ? validCount / safeBase : 0 },
      { key: "catch_all", value: safeBase > 0 ? catchAllCount / safeBase : 0 },
    ],
    GAP,
  ) as Array<Segment & { key: Exclude<GaugeKey, "none"> }>;
  const lastEnd = segments.length > 0 ? segments[segments.length - 1].end : 0;
  const remainder: Segment | null = lastEnd < 1 ? { key: "none", start: lastEnd, end: 1 } : null;

  // Focus only makes sense when there is something to split.
  const interactive = Boolean(onActiveChange) && safeBase > 0;
  const focused = active !== null && safeBase > 0;
  // At rest the centre counts all contacts; focused it shows the outcome's
  // share (the BoardUI stacked-gauge readout). A share never conflicts with
  // the total the way an enrichable-only count would (3 contacts, 2 enrichable).
  const centreValue = focused ? pctOf(counts[active], safeBase) : total;
  const display = useCountUp(centreValue);
  const caption = focused ? CAPTION[active] : label;

  const transition = reduce ? { duration: 0 } : { duration: 0.8, ease: [0.32, 0.72, 0, 1] as const };
  const dim = (key: GaugeKey) => (focused && active !== key ? 0.3 : 1);
  const hit = (key: GaugeKey) =>
    onActiveChange
      ? {
          onMouseEnter: () => onActiveChange(key),
          onMouseLeave: () => onActiveChange(null),
        }
      : {};

  const ariaLabel =
    `${label}: ${fmt(total)}. Valid emails ${fmt(validCount)} (${pctOf(validCount, safeBase)}%), ` +
    `catch-all emails ${fmt(catchAllCount)} (${pctOf(catchAllCount, safeBase)}%), ` +
    `no email found ${fmt(noneCount)} (${pctOf(noneCount, safeBase)}%).`;

  return (
    <div className={cx("relative mx-auto w-[200px]", className)} role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" aria-hidden>
        {/* Track; doubles as the "no email found" remainder. Cap-compensated like
            the segments so its round ends coincide with theirs at 0 and 1. */}
        <path
          d={ARC}
          fill="none"
          stroke="var(--color-chart-track)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${1 - CAP * 2} 1`}
          strokeDashoffset={-CAP}
          opacity={dim("none")}
          className="transition-opacity duration-200 ease-out"
        />
        {segments.map((segment) => {
          const dash = dashFor(segment, CAP);
          const tone = COLOR[segment.key];
          return (
            <motion.path
              key={segment.key}
              d={ARC}
              fill="none"
              stroke={active === segment.key ? tone.active : tone.fill}
              strokeWidth={STROKE}
              strokeLinecap="round"
              initial={{ pathLength: 0, pathOffset: dash.offset, pathSpacing: 1 }}
              animate={{ pathLength: dash.length, pathOffset: dash.offset, pathSpacing: 1 }}
              transition={transition}
              opacity={dim(segment.key)}
              className="transition-[opacity,stroke] duration-200 ease-out"
            />
          );
        })}
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
        {/* Invisible, wider hit areas over each visual range. */}
        {interactive
          ? [...segments, ...(remainder ? [remainder] : [])].map((segment) => (
              <path
                key={`hit-${segment.key}`}
                d={ARC}
                fill="none"
                stroke="transparent"
                strokeWidth={HIT_STROKE}
                strokeLinecap="butt"
                pathLength={1}
                strokeDasharray={`${segment.end - segment.start} 1`}
                strokeDashoffset={-segment.start}
                pointerEvents="stroke"
                {...hit(segment.key as GaugeKey)}
              />
            ))
          : null}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span
          key={`caption:${focused ? active : "rest"}`}
          className="max-w-[128px] animate-number-fade truncate text-body-2-regular text-text-secondary motion-reduce:animate-none"
        >
          {caption}
        </span>
        <span className="text-title-1-medium text-text-primary tabular-nums">
          {focused ? `${display}%` : fmt(display)}
        </span>
      </div>
    </div>
  );
}
