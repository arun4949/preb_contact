import { describe, expect, it } from "vitest";
import { capFraction, dashFor, layoutSegments } from "./geometry";

const GAP = 3 / 180;

describe("layoutSegments", () => {
  it("lays two shares with one gap between them", () => {
    const segs = layoutSegments([{ key: "valid", value: 0.75 }, { key: "catch_all", value: 0.14 }], GAP);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual({ key: "valid", start: 0, end: 0.75 });
    expect(segs[1].start).toBeCloseTo(0.75 + GAP);
    expect(segs[1].end).toBeCloseTo(0.89);
  });

  it("drops zero shares so they consume no gap", () => {
    const segs = layoutSegments([{ key: "valid", value: 1 }, { key: "catch_all", value: 0 }], GAP);
    expect(segs).toEqual([{ key: "valid", start: 0, end: 1 }]);
  });

  it("starts the first non-empty share at 0", () => {
    const segs = layoutSegments([{ key: "valid", value: 0 }, { key: "catch_all", value: 0.14 }], GAP);
    expect(segs).toEqual([{ key: "catch_all", start: 0, end: 0.14 }]);
  });

  it("clamps the running total to the arc", () => {
    const segs = layoutSegments([{ key: "valid", value: 0.6 }, { key: "catch_all", value: 0.6 }], GAP);
    expect(segs[1].end).toBe(1);
    expect(segs[1].start).toBeCloseTo(0.6 + GAP);
  });

  it("ignores NaN and negative shares", () => {
    expect(layoutSegments([{ key: "a", value: Number.NaN }, { key: "b", value: -1 }], GAP)).toEqual([]);
  });
});

describe("dashFor", () => {
  const cap = capFraction(16, 84);

  it("shrinks a wide range by one cap per side", () => {
    const dash = dashFor({ key: "valid", start: 0, end: 0.75 }, cap);
    expect(dash.offset).toBeCloseTo(cap);
    expect(dash.length).toBeCloseTo(0.75 - cap * 2);
  });

  it("collapses a tiny range to a centred dot", () => {
    const dash = dashFor({ key: "catch_all", start: 0.5, end: 0.502 }, cap);
    expect(dash.length).toBe(0);
    expect(dash.offset).toBeCloseTo(0.501);
  });
});

describe("capFraction", () => {
  it("matches stroke / 2 over the arc length", () => {
    expect(capFraction(16, 84)).toBeCloseTo(0.0303, 4);
  });
});
