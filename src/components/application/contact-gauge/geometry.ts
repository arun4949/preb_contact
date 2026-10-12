/**
 * Geometry for the segmented half gauge. Everything is a fraction of the
 * 180° arc (`pathLength = 1`), in physical drawing order from the left end
 * to the right end. Chart geometry: exempt from the logical-direction rules.
 */

export interface Share {
  key: string;
  /** Fraction of the arc this share claims (0–1). */
  value: number;
}

export interface Segment {
  key: string;
  /** Visual start on the arc (0–1). */
  start: number;
  /** Visual end on the arc (0–1). */
  end: number;
}

export interface Dash {
  /** Where the drawn dash starts (0–1). */
  offset: number;
  /** Length of the drawn dash (0–1); `0` renders a dot under round caps. */
  length: number;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Lays adjacent shares along the arc with a visual `gap` between two
 * non-empty neighbours. Zero shares are dropped so they never consume a
 * gap, the running total is clamped to 1, and the first segment starts at
 * 0 so its round cap lines up with the track's cap.
 */
export function layoutSegments(shares: Share[], gap: number): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const share of shares) {
    const value = clamp01(share.value);
    if (value <= 0 || cursor >= 1) continue;
    const start = out.length === 0 ? 0 : Math.min(1, cursor + gap);
    const end = Math.min(1, cursor + value);
    if (end <= start) continue;
    out.push({ key: share.key, start, end });
    cursor = end;
  }
  return out;
}

/**
 * Round caps extend `cap` beyond each end of a dash, so the dash is shrunk
 * by `cap` per side and the caps land exactly on the visual range. A range
 * too narrow to hold both caps collapses to a centred zero-length dash,
 * which round caps render as a dot, so tiny shares still show.
 */
export function dashFor(segment: Segment, cap: number): Dash {
  const span = segment.end - segment.start;
  if (span <= cap * 2) {
    return { offset: segment.start + span / 2, length: 0 };
  }
  return { offset: segment.start + cap, length: span - cap * 2 };
}

/** Fraction of the arc a round cap covers for a stroke on a radius. */
export const capFraction = (stroke: number, radius: number) => stroke / 2 / (Math.PI * radius);
