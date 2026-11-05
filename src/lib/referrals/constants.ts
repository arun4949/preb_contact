/**
 * Referral programme ("Invite friends"): pure constants shared by the server,
 * the settings page and the public landing page. Keep this file free of
 * server imports.
 */

/** Cookie set by /r/<code>/go that attributes a later signup to the code. */
export const REFERRAL_COOKIE = "preb_ref";
/** The cookie only has to live until the signup; the reward window counts from the signup. */
export const REFERRAL_COOKIE_DAYS = 30;
/** Referral credits are valid this long after they are granted (Terms § 6.3). */
export const REFERRAL_REWARD_EXPIRY_MONTHS = 12;
/** Credits the signup trigger grants a new workspace (the landing page promises them). */
export const REFERRAL_TRIAL_CREDITS = 50;

/** Public landing page of a code. */
export function referralPath(code: string) {
  return `/r/${code}`;
}

/** Where the landing page's buttons send the visitor (cookie, click count, then /login). */
export function referralGoPath(code: string) {
  return `/r/${code}/go`;
}

/** Deep link to the referrer's own page in the settings modal. */
export const REFERRALS_SETTINGS_PATH = "/lists?settings=referrals";

export type ReferralStatus = "pending" | "rewarded" | "expired" | "rejected" | "revoked";

export type ReferralRejectedReason =
  | "self_referral"
  | "same_domain"
  | "same_workspace"
  | "not_owner"
  | "recreated_account"
  | "referrer_internal"
  | "code_revoked"
  | "stale_account"
  | "monthly_cap";

export type ReferralSource = "magic_link" | "oauth" | "onboarding";
