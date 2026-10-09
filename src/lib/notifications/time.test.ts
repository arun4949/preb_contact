import { describe, expect, it } from "vitest";
import { groupOf, timeAgo } from "./time";

const now = new Date("2026-10-09T15:00:00").getTime(); // local time, mid-afternoon
const at = (ms: number) => new Date(now - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("timeAgo", () => {
  it("formats recent times compactly", () => {
    expect(timeAgo(at(10_000), now)).toBe("now");
    expect(timeAgo(at(5 * MIN), now)).toBe("5m");
    expect(timeAgo(at(3 * HOUR), now)).toBe("3h");
  });
  it("switches to days and dates", () => {
    expect(timeAgo(at(DAY), now)).toBe("Yesterday");
    expect(timeAgo(at(3 * DAY), now)).toMatch(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    expect(timeAgo(at(20 * DAY), now)).toBe("Sep 19");
    expect(timeAgo("2025-03-02T12:00:00", now)).toBe("Mar 2, 2025");
  });
  it("tolerates bad input", () => {
    expect(timeAgo("nope", now)).toBe("");
  });
});

describe("groupOf", () => {
  it("buckets by calendar day", () => {
    expect(groupOf(at(HOUR), now)).toBe("Today");
    expect(groupOf(at(DAY), now)).toBe("Yesterday");
    expect(groupOf(at(4 * DAY), now)).toBe("This week");
    expect(groupOf(at(10 * DAY), now)).toBe("Earlier");
  });
});
