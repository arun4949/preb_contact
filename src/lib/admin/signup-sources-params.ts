/**
 * URL state of /admin/sources. Unknown values fall back to the default
 * instead of reaching the database (same rules as accounts-params.ts).
 */
export const SOURCE_PERIODS = ["30d", "90d", "all"] as const;
export type SourcePeriod = (typeof SOURCE_PERIODS)[number];

export const SOURCE_PERIOD_DAYS: Record<SourcePeriod, number | null> = { "30d": 30, "90d": 90, all: null };

export const SOURCE_TEAM_MODES = ["exclude", "include"] as const;
export type SourceTeamMode = (typeof SOURCE_TEAM_MODES)[number];

export const SOURCES_PAGE_SIZE = 25;

export interface SourcesParams {
  period: SourcePeriod;
  /** Team accounts (admins and owners of the internal workspace) are test signups: left out unless asked for. */
  team: SourceTeamMode;
  page: number;
}

type Raw = Record<string, string | string[] | undefined>;

function first(raw: Raw, key: string): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseSourcesParams(raw: Raw): SourcesParams {
  const page = first(raw, "page");
  return {
    period: oneOf(first(raw, "period"), SOURCE_PERIODS, "90d"),
    team: oneOf(first(raw, "team"), SOURCE_TEAM_MODES, "exclude"),
    page: /^\d{1,6}$/.test(page) ? Math.max(1, Number(page)) : 1,
  };
}

/** Start of the period as an ISO timestamp, null for all time. */
export function periodSince(period: SourcePeriod, now = Date.now()): string | null {
  const days = SOURCE_PERIOD_DAYS[period];
  return days === null ? null : new Date(now - days * 86_400_000).toISOString();
}
