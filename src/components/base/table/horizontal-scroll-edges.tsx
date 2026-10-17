"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { cx } from "@/utils/cx";

/**
 * Horizontal counterpart of the vertical scroll fade: a wide table scrolls
 * sideways, and nothing on a Mac tells a new user so. Two stationary,
 * pointer-transparent gradients sit over the scroll container, one on the
 * end edge while more columns are hidden there, one just after the sticky
 * first column once the user has scrolled. Each fades over the first 32px
 * of scrolling and disappears at the ends, so the cue is only there while it
 * is true. Pair with `bui-table-scroll` on the container, which keeps a slim
 * scrollbar visible regardless of the OS setting.
 */

const RAMP_PX = 32;

export interface HorizontalScrollState {
  /** 0–1: how much of the start-edge fade to show. */
  start: number;
  /** 0–1: how much of the end-edge fade to show. */
  end: number;
  /** Width of the sticky first column, so the start fade sits after it. */
  stickyWidth: number;
}

/** Measures a horizontally scrolling container; re-measures on scroll, resize and content changes. */
export function useHorizontalScroll(ref: RefObject<HTMLDivElement | null>): HorizontalScrollState {
  const [state, setState] = useState<HorizontalScrollState>({ start: 0, end: 0, stickyWidth: 0 });
  const last = useRef(state);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // RTL containers report negative scrollLeft; the distance from the start edge is what matters.
    const fromStart = Math.abs(el.scrollLeft);
    const next = {
      start: max > 0 ? Math.min(1, fromStart / RAMP_PX) : 0,
      end: max > 0 ? Math.min(1, (max - fromStart) / RAMP_PX) : 0,
      stickyWidth: (el.querySelector("thead th") as HTMLElement | null)?.offsetWidth ?? 0,
    };
    const prev = last.current;
    if (prev.start === next.start && prev.end === next.end && prev.stickyWidth === next.stickyWidth) return;
    last.current = next;
    setState(next);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const table = el.firstElementChild;
    if (table) ro?.observe(table);
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [ref, measure]);

  // Column visibility or a new page of rows changes the width without a scroll event.
  useEffect(() => {
    measure();
  });

  return state;
}

export interface HorizontalScrollEdgesProps extends HorizontalScrollState {
  /** Gradient colour, the enclosing surface token (`from-…`). */
  surfaceClassName?: string;
  className?: string;
}

/** The two edge fades. Render inside a `relative` wrapper around the scroll container. */
export function HorizontalScrollEdges({ start, end, stickyWidth, surfaceClassName = "from-background-primary-default", className }: HorizontalScrollEdgesProps) {
  return (
    <div aria-hidden className={cx("pointer-events-none absolute inset-y-0 inset-x-0 z-20", className)}>
      <div
        style={{ opacity: start, insetInlineStart: stickyWidth }}
        className={cx("absolute inset-y-0 w-10 bg-gradient-to-r to-transparent transition-opacity duration-150 rtl:bg-gradient-to-l", surfaceClassName)}
      />
      <div style={{ opacity: end }} className={cx("absolute inset-y-0 end-0 w-16 bg-gradient-to-l to-transparent transition-opacity duration-150 rtl:bg-gradient-to-r", surfaceClassName)} />
    </div>
  );
}
