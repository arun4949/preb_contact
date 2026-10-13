import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashOptOutToken, looksLikeOptOutToken } from "./token";

export type OptOutOutcome = "valid" | "used" | "expired" | "invalid";

export interface OptOutRequestView {
  outcome: OptOutOutcome;
  hint: string | null;
  confirmedAt: string | null;
  /** Phone and LinkedIn identifiers still waiting for a founder. */
  pendingReview: number;
}

/** What the confirm page shows for a link. Never exposes the raw email. */
export async function getOptOutRequestByToken(token: string): Promise<OptOutRequestView> {
  if (!looksLikeOptOutToken(token)) return { outcome: "invalid", hint: null, confirmedAt: null, pendingReview: 0 };
  const admin = createAdminClient();
  const { data } = await admin
    .from("opt_out_requests")
    .select("id, status, email_hint, expires_at, confirmed_at, identifiers:opt_out_identifiers(status)")
    .eq("token_hash", hashOptOutToken(token))
    .maybeSingle();
  if (!data) return { outcome: "invalid", hint: null, confirmedAt: null, pendingReview: 0 };
  const identifiers = (data.identifiers ?? []) as { status: string }[];
  const pendingReview = identifiers.filter((i) => i.status === "pending").length;
  if (data.status === "confirmed") return { outcome: "used", hint: data.email_hint, confirmedAt: data.confirmed_at, pendingReview };
  if (data.status === "expired" || new Date(data.expires_at) < new Date()) return { outcome: "expired", hint: data.email_hint, confirmedAt: null, pendingReview };
  return { outcome: "valid", hint: data.email_hint, confirmedAt: null, pendingReview };
}
