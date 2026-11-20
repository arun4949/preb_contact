import { describe, expect, it } from "vitest";
import { parseSourcesParams, periodSince } from "./signup-sources-params";

describe("parseSourcesParams", () => {
  it("falls back to the defaults", () => {
    expect(parseSourcesParams({})).toEqual({ view: "sources", period: "90d", team: "exclude", page: 1 });
  });

  it("accepts known values", () => {
    expect(parseSourcesParams({ view: "ats", period: "all", team: "include", page: "3" })).toEqual({ view: "ats", period: "all", team: "include", page: 3 });
  });

  it("ignores hostile values and repeated keys", () => {
    expect(parseSourcesParams({ view: "ATS", period: "1 year; drop", team: ["include", "x"], page: "-2" })).toEqual({ view: "sources", period: "90d", team: "include", page: 1 });
    expect(parseSourcesParams({ page: "1e9" }).page).toBe(1);
    expect(parseSourcesParams({ page: "0" }).page).toBe(1);
  });
});

describe("periodSince", () => {
  const now = Date.parse("2026-11-19T12:00:00Z");
  it("goes back the right number of days, or not at all", () => {
    expect(periodSince("30d", now)).toBe("2026-10-20T12:00:00.000Z");
    expect(periodSince("90d", now)).toBe("2026-08-21T12:00:00.000Z");
    expect(periodSince("all", now)).toBeNull();
  });
});
