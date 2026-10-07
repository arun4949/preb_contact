import "server-only";

import { PROVIDER, type Admin } from "./shared";

export type RateKind = "submit" | "get";

/**
 * One provider call = one slot in the current calendar minute
 * (40 submits + 10 GETs, enforced atomically in `claim_rate_slot`). Returns
 * false when the budget for this minute is spent; the caller stops and the
 * next tick continues.
 */
export async function claimRateSlot(admin: Admin, kind: RateKind): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_rate_slot", { p_provider: PROVIDER, p_kind: kind });
  if (error) throw new Error(`claim_rate_slot failed: ${error.message}`);
  return data === true;
}
