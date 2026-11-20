import { describe, expect, it } from "vitest";
import { atsStats, type AtsRow } from "./signup-ats-stats";

function row(patch: Partial<AtsRow>): AtsRow {
  return {
    userId: "u",
    email: "a@acme.com",
    fullName: null,
    workspaceName: null,
    status: "answered",
    ats: "bullhorn",
    detail: null,
    askedAt: "2026-11-20T10:00:00Z",
    respondedAt: "2026-11-20T10:00:20Z",
    paying: false,
    creditsSpent: 0,
    team: false,
    ...patch,
  };
}

describe("atsStats", () => {
  it("is all zeros for no rows", () => {
    expect(atsStats([])).toEqual({ asked: 0, answered: 0, skipped: 0, noResponse: 0, byAts: [], quality: { usesAts: 0, none: 0, other: 0, otherWithDetail: 0 }, byMonth: [] });
  });

  it("splits asked into answered, skipped and no response", () => {
    const stats = atsStats([row({}), row({}), row({ status: "skipped", ats: null }), row({ status: "pending", ats: null })]);
    expect(stats).toMatchObject({ asked: 4, answered: 2, skipped: 1, noResponse: 1 });
  });

  it("does not count an answered row without a key as an answer", () => {
    expect(atsStats([row({ ats: null })])).toMatchObject({ asked: 1, answered: 0, noResponse: 1 });
  });

  it("ranks systems by answers, then by label, with paying accounts and spend", () => {
    const stats = atsStats([
      row({ ats: "loxo", paying: true, creditsSpent: 100 }),
      row({ ats: "loxo", creditsSpent: 20 }),
      row({ ats: "bullhorn", paying: true, creditsSpent: 5 }),
      row({ ats: "ashby" }),
    ]);
    expect(stats.byAts).toEqual([
      { key: "loxo", label: "Loxo", answers: 2, paying: 1, creditsSpent: 120 },
      { key: "ashby", label: "Ashby", answers: 1, paying: 0, creditsSpent: 0 },
      { key: "bullhorn", label: "Bullhorn", answers: 1, paying: 1, creditsSpent: 5 },
    ]);
  });

  it("separates teams with a system from teams without one, and reads the Other details", () => {
    const stats = atsStats([row({}), row({ ats: "none" }), row({ ats: "other", detail: "Workday" }), row({ ats: "other" })]);
    expect(stats.quality).toEqual({ usesAts: 3, none: 1, other: 2, otherWithDetail: 1 });
    expect(stats.byAts.find((entry) => entry.key === "none")?.label).toBe("No ATS");
  });

  it("keeps an answer readable after its option left the list", () => {
    expect(atsStats([row({ ats: "smart_recruiters" })]).byAts[0].label).toBe("Smart recruiters");
  });

  it("groups by the month asked, newest first, with the top system", () => {
    const stats = atsStats([
      row({ askedAt: "2026-11-20T10:00:00Z", ats: "loxo" }),
      row({ askedAt: "2026-11-21T10:00:00Z", ats: "loxo" }),
      row({ askedAt: "2026-11-22T10:00:00Z", ats: "ashby" }),
      row({ askedAt: "2026-12-01T10:00:00Z", status: "skipped", ats: null }),
    ]);
    expect(stats.byMonth).toEqual([
      { month: "2026-12", asked: 1, answered: 0, topAts: null },
      { month: "2026-11", asked: 3, answered: 3, topAts: "loxo" },
    ]);
  });
});
