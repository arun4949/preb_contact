import { SIGNUP_ATS_PATH } from "./signup-ats";
import { SIGNUP_SOURCE_PATH } from "./signup-source";

/**
 * The order of the optional onboarding questions that follow the workspace
 * card: the source question, then the ATS question, then the app. Pure, so the
 * chain is unit tested; `steps-store.ts` feeds it from the database.
 *
 * A step is open while its row is pending and fresh. Every page and action of
 * the flow asks this one function where to go, so they always agree.
 */
export const ONBOARDING_DONE_PATH = "/lists";

export interface OpenOnboardingSteps {
  source: boolean;
  ats: boolean;
}

export function nextOnboardingPath(open: OpenOnboardingSteps): string {
  if (open.source) return SIGNUP_SOURCE_PATH;
  if (open.ats) return SIGNUP_ATS_PATH;
  return ONBOARDING_DONE_PATH;
}
