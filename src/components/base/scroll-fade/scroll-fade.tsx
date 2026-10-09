"use client";

import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "@/utils/cx";

/**
 * Internal vertical scroll region whose top edge softens once scrolled
 * (AGENTS.md rule): a stationary overlay with a 24px masked 1px blur, a 16px
 * masked 4px blur and a surface gradient, each fading in over the first 24px
 * of scrolling. Opacity sits on the individual layers, never on the overlay
 * parent (a translucent parent would create a backdrop root and break the
 * blur at normal zoom). Invisible at scrollTop 0; headers stay outside.
 */
export interface ScrollFadeProps extends HTMLAttributes<HTMLDivElement> {
  /** Gradient start, matching the enclosing surface token (`from-…`). */
  surfaceClassName?: string;
  /** Classes for the outer, relatively positioned wrapper. */
  wrapperClassName?: string;
  children: ReactNode;
}

const RAMP_PX = 24;

export function ScrollFade({ surfaceClassName = "from-background-secondary-default", wrapperClassName, className, children, onScroll, ...props }: ScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(0);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setOpacity(Math.min(1, el.scrollTop / RAMP_PX));
  }, []);

  // Content changes (new rows, tab switch) can move scrollTop without a scroll event.
  useEffect(() => {
    measure();
  });

  return (
    <div className={cx("relative min-h-0", wrapperClassName)}>
      <div
        ref={ref}
        onScroll={(event) => {
          measure();
          onScroll?.(event);
        }}
        className={cx("overflow-y-auto overscroll-contain", className)}
        {...props}
      >
        {children}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6">
        <div style={{ opacity }} className="absolute inset-x-0 top-0 h-6 backdrop-blur-[1px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div style={{ opacity }} className="absolute inset-x-0 top-0 h-4 backdrop-blur-[4px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div style={{ opacity }} className={cx("absolute inset-x-0 top-0 h-6 bg-gradient-to-b to-transparent", surfaceClassName)} />
      </div>
    </div>
  );
}
