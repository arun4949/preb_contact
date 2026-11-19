import { describe, expect, it } from "vitest";
import { monthLabel, sourceStats, type SourceRow } from "./signup-sources-stats";

function row(patch: Partial<SourceRow>): SourceRow {
  return {
    userId: "u",
    email: "a@acme.com",
    fullName: null,
    workspaceName: null,
    status: "answered",
    source: "linkedin",
    detail: null,
    shownPosition: 3,
    optionsCount: 12,
    askedAt: "2026-11-10T10:00:00Z",
    respondedAt: "2026-11-10T10:00:20Z",
    paying: false,
    creditsSpent: 0,
    metaAttribution: "none",
    referralStatus: null,
    fromLeadShare: false,
    team: false,
    ...patch,
  };
}

describe("sourceStats", () => {
  it("is all zeros for no rows", () => {
    const stats = sourceStats([]);
    expect(stats).toMatchObject({ asked: 0, answered: 0, skipped: 0, noResponse: 0, bySource: [], byMonth: [] });
    expect(stats.answeredTracked.total).toBe(0);
  });

  it("splits asked into answered, skipped and no response", () => {
    const stats = sourceStats([row({}), row({}), row({ status: "skipped", source: null }), row({ status: "pending", source: null })]);
    expect(stats).toMatchObject({ asked: 4, answered: 2, skipped: 1, noResponse: 1 });
  });

  it("ranks sources by answers, then by label, with paying accounts and spend", () => {
    const stats = sourceStats([
      row({ source: "colleague", paying: true, creditsSpent: 300 }),
      row({ source: "colleague", creditsSpent: 50 }),
      row({ source: "linkedin" }),
      row({ source: "ai_assistant", paying: true }),
    ]);
    expect(stats.bySource.map((s) => [s.key, s.answers, s.paying, s.creditsSpent])).toEqual([
      ["colleague", 2, 1, 350],
      ["ai_assistant", 1, 1, 0],
      ["linkedin", 1, 0, 0],
    ]);
  });

  it("compares answers with what was tracked", () => {
    const stats = sourceStats([
      row({ source: "instagram", metaAttribution: "ad_click" }),
      row({ source: "instagram", metaAttribution: "cookie_only" }),
      row({ source: "colleague", referralStatus: "pending" }),
      row({ source: "colleague", referralStatus: "rejected" }),
      row({ source: "colleague", fromLeadShare: true, metaAttribution: null }),
      row({ status: "skipped", source: null, metaAttribution: "ad_click" }),
    ]);
    const instagram = stats.tracked.find((t) => t.key === "instagram")!.counts;
    const colleague = stats.tracked.find((t) => t.key === "colleague")!.counts;
    expect(instagram).toEqual({ total: 2, metaAdClick: 1, referral: 0, leadMagnet: 0, untracked: 1 });
    // A rejected referral is not a tracked source.
    expect(colleague).toEqual({ total: 3, metaAdClick: 0, referral: 1, leadMagnet: 1, untracked: 1 });
    expect(stats.answeredTracked).toEqual({ total: 5, metaAdClick: 1, referral: 1, leadMagnet: 1, untracked: 2 });
    expect(stats.noAnswerTracked).toEqual({ total: 1, metaAdClick: 1, referral: 0, leadMagnet: 0, untracked: 0 });
  });

  it("measures answer quality and position bias", () => {
    const stats = sourceStats([
      row({ source: "other", detail: "A conference", shownPosition: 11 }),
      row({ source: "not_sure", shownPosition: 12 }),
      row({ source: "search", shownPosition: 1 }),
      row({ source: "search", shownPosition: 1, optionsCount: 0 }),
    ]);
    expect(stats.quality.other).toBe(1);
    expect(stats.quality.notSure).toBe(1);
    expect(stats.quality.withDetail).toBe(1);
    expect(stats.quality.firstPicked).toBe(2);
    expect(stats.quality.firstExpected).toBeCloseTo(3 / 12);
  });

  it("groups by month, newest first, with the top source of each", () => {
    const stats = sourceStats([
      row({ askedAt: "2026-10-03T08:00:00Z", source: "tiktok" }),
      row({ askedAt: "2026-11-02T08:00:00Z", source: "search" }),
      row({ askedAt: "2026-11-05T08:00:00Z", source: "search" }),
      row({ askedAt: "2026-11-06T08:00:00Z", source: "linkedin" }),
      row({ askedAt: "2026-11-07T08:00:00Z", status: "pending", source: null }),
    ]);
    expect(stats.byMonth).toEqual([
      { month: "2026-11", asked: 4, answered: 3, topSource: "search" },
      { month: "2026-10", asked: 1, answered: 1, topSource: "tiktok" },
    ]);
  });
});

describe("monthLabel", () => {
  it("names the month", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
    expect(monthLabel("2027-01")).toBe("January 2027");
  });
});
