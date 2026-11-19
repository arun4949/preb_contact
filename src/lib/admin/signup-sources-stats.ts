import type { MetaAttribution } from "./attribution";
import { signupSourceLabel, type SignupSourceStatus } from "./signup-source-meta";

/**
 * Aggregation for /admin/sources. Pure, so the numbers on the page are unit
 * tested. Input is one row per asked person (`admin_signup_sources`).
 *
 * Shares of a source are always shares of the answers, never of everyone
 * asked: skipped and unanswered rows say nothing about the channel.
 */

export interface SourceRow {
  userId: string;
  email: string;
  fullName: string | null;
  workspaceName: string | null;
  status: SignupSourceStatus;
  source: string | null;
  detail: string | null;
  /** 1-based place of the picked option in the order the person saw. */
  shownPosition: number | null;
  optionsCount: number;
  askedAt: string;
  respondedAt: string | null;
  paying: boolean;
  creditsSpent: number;
  /** Meta verdict stored when the person was asked; null when it could not be read then. */
  metaAttribution: MetaAttribution | null;
  /** Counted as tracked unless the referral rules rejected it. */
  referralStatus: string | null;
  fromLeadShare: boolean;
  /** An admin's own account or the owner of the internal workspace: a test signup. */
  team: boolean;
}

export interface SourceBreakdown {
  key: string;
  label: string;
  answers: number;
  paying: number;
  creditsSpent: number;
}

export interface TrackedCounts {
  total: number;
  metaAdClick: number;
  referral: number;
  leadMagnet: number;
  /** None of the three: the answer is the only thing we know. */
  untracked: number;
}

export interface SourceMonth {
  /** "2026-11" */
  month: string;
  asked: number;
  answered: number;
  topSource: string | null;
}

export interface SourceStats {
  asked: number;
  answered: number;
  skipped: number;
  noResponse: number;
  /** Most answers first; ties in label order. */
  bySource: SourceBreakdown[];
  /** One entry per answered source, then `noAnswer` for skipped and unanswered. */
  tracked: { key: string; label: string; counts: TrackedCounts }[];
  noAnswerTracked: TrackedCounts;
  answeredTracked: TrackedCounts;
  quality: {
    other: number;
    notSure: number;
    withDetail: number;
    /** Answers that picked the chip shown first, and how many that would be by chance. */
    firstPicked: number;
    firstExpected: number;
  };
  /** Newest month first. */
  byMonth: SourceMonth[];
}

const isReferred = (row: SourceRow) => row.referralStatus !== null && row.referralStatus !== "rejected";

function emptyTracked(): TrackedCounts {
  return { total: 0, metaAdClick: 0, referral: 0, leadMagnet: 0, untracked: 0 };
}

function addTracked(counts: TrackedCounts, row: SourceRow): void {
  const meta = row.metaAttribution === "ad_click";
  const referral = isReferred(row);
  counts.total += 1;
  if (meta) counts.metaAdClick += 1;
  if (referral) counts.referral += 1;
  if (row.fromLeadShare) counts.leadMagnet += 1;
  if (!meta && !referral && !row.fromLeadShare) counts.untracked += 1;
}

function topOf(counts: Map<string, number>): string | null {
  let best: string | null = null;
  for (const [key, count] of counts) {
    if (best === null || count > counts.get(best)! || (count === counts.get(best)! && signupSourceLabel(key) < signupSourceLabel(best))) best = key;
  }
  return best;
}

export function sourceStats(rows: readonly SourceRow[]): SourceStats {
  const bySource = new Map<string, SourceBreakdown>();
  const tracked = new Map<string, TrackedCounts>();
  const noAnswerTracked = emptyTracked();
  const answeredTracked = emptyTracked();
  const months = new Map<string, { asked: number; answered: number; sources: Map<string, number> }>();
  const quality = { other: 0, notSure: 0, withDetail: 0, firstPicked: 0, firstExpected: 0 };
  let answered = 0;
  let skipped = 0;
  let noResponse = 0;

  for (const row of rows) {
    const monthKey = row.askedAt.slice(0, 7);
    const month = months.get(monthKey) ?? { asked: 0, answered: 0, sources: new Map<string, number>() };
    months.set(monthKey, month);
    month.asked += 1;

    if (row.status !== "answered" || !row.source) {
      if (row.status === "skipped") skipped += 1;
      else noResponse += 1;
      addTracked(noAnswerTracked, row);
      continue;
    }

    answered += 1;
    month.answered += 1;
    month.sources.set(row.source, (month.sources.get(row.source) ?? 0) + 1);

    const entry = bySource.get(row.source) ?? { key: row.source, label: signupSourceLabel(row.source), answers: 0, paying: 0, creditsSpent: 0 };
    bySource.set(row.source, entry);
    entry.answers += 1;
    if (row.paying) entry.paying += 1;
    entry.creditsSpent += row.creditsSpent;

    const counts = tracked.get(row.source) ?? emptyTracked();
    tracked.set(row.source, counts);
    addTracked(counts, row);
    addTracked(answeredTracked, row);

    if (row.source === "other") quality.other += 1;
    if (row.source === "not_sure") quality.notSure += 1;
    if (row.detail) quality.withDetail += 1;
    if (row.shownPosition === 1) quality.firstPicked += 1;
    if (row.optionsCount > 0) quality.firstExpected += 1 / row.optionsCount;
  }

  const ordered = [...bySource.values()].sort((a, b) => b.answers - a.answers || a.label.localeCompare(b.label));
  return {
    asked: rows.length,
    answered,
    skipped,
    noResponse,
    bySource: ordered,
    tracked: ordered.map((entry) => ({ key: entry.key, label: entry.label, counts: tracked.get(entry.key)! })),
    noAnswerTracked,
    answeredTracked,
    quality,
    byMonth: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, asked: m.asked, answered: m.answered, topSource: topOf(m.sources) })),
  };
}

/** "November 2026" from "2026-11". */
export function monthLabel(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year, index - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
