import "server-only";

import { hasFreshPendingSignupAts } from "./signup-ats-store";
import { hasFreshPendingSignupSource } from "./signup-source-store";
import { nextOnboardingPath } from "./steps";

/**
 * Where a new owner goes next: the first optional question still open, else
 * the app. Both reads return false on an error, so a broken read ends in the
 * app and never in a step that cannot save.
 */
export async function nextOnboardingPathFor(userId: string): Promise<string> {
  const [source, ats] = await Promise.all([hasFreshPendingSignupSource(userId), hasFreshPendingSignupAts(userId)]);
  return nextOnboardingPath({ source, ats });
}
