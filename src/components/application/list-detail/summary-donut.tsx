"use client";

import { motion, useReducedMotion } from "motion/react";
import { dashFor, layoutSegments } from "@/components/application/contact-gauge/geometry";
import { cx } from "@/utils/cx";

export interface DonutSegment {
  key: string;
  /** Count behind the segment (shares are computed against `total`). */
  value: number;
  /** CSS colour, usually a chart token: `var(--color-chart-1)`. */
  color: string;
  /** Colour while selected (the `-active` token). */
  activeColor?: string;
  label: string;
}

export interface SummaryDonutProps {
  segments: DonutSegment[];
  /** Denominator; the remainder of the ring stays on the track colour. */
  total: number;
  /** Segment currently used as a filter: it keeps its colour, the others dim. */
  selectedKey?: string | null;
  /** Click (or Enter / Space) on a segment. Also fired for the remainder with `remainderKey`. */
  onSelect?: (key: string) => void;
  remainderKey?: string;
  remainderLabel?: string;
  size?: number;
  className?: string;
}

const STROKE = 7;
/** Visual gap between two segments: 2° of the 360° ring. */
const GAP = 2 / 360;

/**
 * Compact full ring for the summary cards: the BoardUI stacked-gauge recipe
 * closed into a circle. Segments start at 12 o'clock, run clockwise, have
 * round caps and a 2° gap. Chart geometry, so physical coordinates. An
 * optional `onSelect` makes each range a keyboard-reachable button.
 */
export function SummaryDonut({ segments, total, selectedKey = null, onSelect, remainderKey, remainderLabel = "Not found", size = 56, className }: SummaryDonutProps) {
  const reduce = useReducedMotion();
  const r = (size - STROKE) / 2;
  const c = size / 2;
  /** Fraction of the ring a round cap covers. */
  const cap = STROKE / 2 / (2 * Math.PI * r);
  const base = Math.max(0, total);
  const arc = `M ${c} ${c - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`;

  const laid = layoutSegments(
    segments.map((s) => ({ key: s.key, value: base > 0 ? Math.max(0, s.value) / base : 0 })),
    GAP,
  );
  const lastEnd = laid.length > 0 ? laid[laid.length - 1].end : 0;
  const remainder = lastEnd < 1 ? { key: remainderKey ?? "__rest", start: lastEnd, end: 1 } : null;
  const byKey = new Map(segments.map((s) => [s.key, s]));
  const focused = selectedKey !== null && selectedKey !== undefined;
  const dim = (key: string) => (focused && selectedKey !== key ? 0.3 : 1);
  const interactive = Boolean(onSelect) && base > 0;
  const transition = reduce ? { duration: 0 } : { duration: 0.8, ease: [0.32, 0.72, 0, 1] as const };

  const hit = (key: string, label: string, start: number, end: number) =>
    interactive ? (
      <path
        key={`hit-${key}`}
        d={arc}
        fill="none"
        stroke="transparent"
        strokeWidth={STROKE + 10}
        pathLength={1}
        strokeDasharray={`${end - start} 1`}
        strokeDashoffset={-start}
        pointerEvents="stroke"
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={selectedKey === key}
        className="cursor-pointer outline-none"
        onClick={() => onSelect?.(key)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect?.(key);
          }
        }}
      />
    ) : null;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cx("block shrink-0 overflow-visible", className)}
      aria-hidden={!interactive}
      role={interactive ? "group" : undefined}
    >
      <path
        d={arc}
        fill="none"
        stroke="var(--color-chart-track)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${1 - cap * 2} 1`}
        strokeDashoffset={-cap}
        opacity={remainder ? dim(remainder.key) : 1}
        className="transition-opacity duration-200 ease-out"
      />
      {laid.map((segment) => {
        const dash = dashFor(segment, cap);
        const tone = byKey.get(segment.key)!;
        const selected = selectedKey === segment.key;
        return (
          <motion.path
            key={segment.key}
            d={arc}
            fill="none"
            stroke={selected && tone.activeColor ? tone.activeColor : tone.color}
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
      {laid.map((segment) => hit(segment.key, byKey.get(segment.key)!.label, segment.start, segment.end))}
      {remainder && remainderKey ? hit(remainder.key, remainderLabel, remainder.start, remainder.end) : null}
    </svg>
  );
}
