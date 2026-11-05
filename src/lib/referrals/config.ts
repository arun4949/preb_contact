import "server-only";

/**
 * Referral programme settings. All three are env vars with defaults so a
 * missing value never breaks the webhook; a value that is not a positive
 * integer falls back too.
 */

const DEFAULT_REWARD_CREDITS = 500;
const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_MONTHLY_CAP = 10;

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Credits the referrer's workspace earns per rewarded referral (`REFERRAL_REWARD_CREDITS`). */
export function rewardCredits(): number {
  return positiveInt(process.env.REFERRAL_REWARD_CREDITS, DEFAULT_REWARD_CREDITS);
}

/** Days after the referee's signup in which their first paid invoice still counts (`REFERRAL_WINDOW_DAYS`). */
export function windowDays(): number {
  return positiveInt(process.env.REFERRAL_WINDOW_DAYS, DEFAULT_WINDOW_DAYS);
}

/** Rewarded referrals per referrer workspace in a rolling 30 days (`REFERRAL_MAX_REWARDS_PER_MONTH`). */
export function monthlyCap(): number {
  return positiveInt(process.env.REFERRAL_MAX_REWARDS_PER_MONTH, DEFAULT_MONTHLY_CAP);
}
