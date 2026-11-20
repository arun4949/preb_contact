import { SIGNUP_ATS_NONE, SIGNUP_ATS_OTHER } from "@/lib/onboarding/signup-ats";
import { signupAtsLabel } from "./signup-ats-meta";
import type { SignupSourceStatus } from "./signup-source-meta";

/**
 * Aggregation for the ATS view of /admin/insights. Pure, so the numbers on the
 * page are unit tested. Input is one row per asked person (`admin_signup_ats`).
 *
 * Shares of a system are always shares of the answers, never of everyone
 * asked: skipped and unanswered rows say nothing about the tool.
 */

export interface AtsRow {
  userId: string;
  email: string;
  fullName: string | null;
  workspaceName: string | null;
  status: SignupSourceStatus;
  ats: string | null;
  /** Free text of the "Other" option. */
  detail: string | null;
  askedAt: string;
  respondedAt: string | null;
  paying: boolean;
  creditsSpent: number;
  /** An admin's own account or the owner of the internal workspace: a test signup. */
  team: boolean;
}

export interface AtsBreakdown {
  key: string;
  label: string;
  answers: number;
  paying: number;
  creditsSpent: number;
}

export interface AtsMonth {
  /** "2026-11" */
  month: string;
  asked: number;
  answered: number;
  topAts: string | null;
}

export interface AtsStats {
  asked: number;
  answered: number;
  skipped: number;
  noResponse: number;
  /** Most answers first; ties in label order. */
  byAts: AtsBreakdown[];
  quality: {
    /** Answers that name a system, listed or typed in. */
    usesAts: number;
    none: number;
    other: number;
    /** "Other" answers that say which system. */
    otherWithDetail: number;
  };
  /** Newest month first. */
  byMonth: AtsMonth[];
}

function topOf(counts: Map<string, number>): string | null {
  let best: string | null = null;
  for (const [key, count] of counts) {
    if (best === null || count > counts.get(best)! || (count === counts.get(best)! && signupAtsLabel(key) < signupAtsLabel(best))) best = key;
  }
  return best;
}

export function atsStats(rows: readonly AtsRow[]): AtsStats {
  const byAts = new Map<string, AtsBreakdown>();
  const months = new Map<string, { asked: number; answered: number; systems: Map<string, number> }>();
  const quality = { usesAts: 0, none: 0, other: 0, otherWithDetail: 0 };
  let answered = 0;
  let skipped = 0;
  let noResponse = 0;

  for (const row of rows) {
    const monthKey = row.askedAt.slice(0, 7);
    const month = months.get(monthKey) ?? { asked: 0, answered: 0, systems: new Map<string, number>() };
    months.set(monthKey, month);
    month.asked += 1;

    if (row.status !== "answered" || !row.ats) {
      if (row.status === "skipped") skipped += 1;
      else noResponse += 1;
      continue;
    }

    answered += 1;
    month.answered += 1;
    month.systems.set(row.ats, (month.systems.get(row.ats) ?? 0) + 1);

    const entry = byAts.get(row.ats) ?? { key: row.ats, label: signupAtsLabel(row.ats), answers: 0, paying: 0, creditsSpent: 0 };
    byAts.set(row.ats, entry);
    entry.answers += 1;
    if (row.paying) entry.paying += 1;
    entry.creditsSpent += row.creditsSpent;

    if (row.ats === SIGNUP_ATS_NONE) quality.none += 1;
    else quality.usesAts += 1;
    if (row.ats === SIGNUP_ATS_OTHER) {
      quality.other += 1;
      if (row.detail) quality.otherWithDetail += 1;
    }
  }

  return {
    asked: rows.length,
    answered,
    skipped,
    noResponse,
    byAts: [...byAts.values()].sort((a, b) => b.answers - a.answers || a.label.localeCompare(b.label)),
    quality,
    byMonth: [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, m]) => ({ month, asked: m.asked, answered: m.answered, topAts: topOf(m.systems) })),
  };
}
