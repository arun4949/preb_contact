import "server-only";

import { isAdminEmail } from "@/lib/auth/work-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Part } from "./accounts";
import type { MetaAttribution } from "./attribution";
import { signupSourceStatus } from "./signup-source-meta";
import type { SourceRow } from "./signup-sources-stats";

/**
 * Data for /admin/sources: everyone who was asked "How did you first hear
 * about Preb?" in the period, one row each (`admin_signup_sources`, migration
 * 0035). Service-role read across all accounts, so the loader checks the
 * allowlist itself on top of the page guard. A failed query is returned as an
 * error, never as an empty result.
 */

const PAGE = 1000;
const META: readonly string[] = ["ad_click", "cookie_only", "none"];

export async function getSignupSources(since: string | null): Promise<Part<SourceRow[]>> {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
  const admin = createAdminClient();

  const rows: SourceRow[] = [];
  // PostgREST caps a response at 1000 rows: read every page (the function orders by asked_at, user_id).
  for (let from = 0; from < 100 * PAGE; from += PAGE) {
    const { data, error } = await admin.rpc("admin_signup_sources", since ? { p_since: since } : {}).range(from, from + PAGE - 1);
    if (error) return { data: null, error: `${error.code ? `${error.code} ` : ""}${error.message}` };
    // The generated types mark every column as present; the left joins and optional columns make these nullable.
    const page = (data ?? []) as unknown as (Omit<
      NonNullable<typeof data>[number],
      "full_name" | "source" | "detail" | "shown_position" | "responded_at" | "workspace_name" | "plan_key" | "meta_attribution" | "referral_status"
    > & {
      full_name: string | null;
      source: string | null;
      detail: string | null;
      shown_position: number | null;
      responded_at: string | null;
      workspace_name: string | null;
      plan_key: string | null;
      meta_attribution: string | null;
      referral_status: string | null;
    })[];
    for (const r of page) {
      rows.push({
        userId: r.user_id,
        email: r.email,
        fullName: r.full_name,
        workspaceName: r.workspace_name,
        status: signupSourceStatus(r.status),
        source: r.source,
        detail: r.detail,
        shownPosition: r.shown_position,
        optionsCount: r.options_count,
        askedAt: r.asked_at,
        respondedAt: r.responded_at,
        paying: r.plan_key !== null,
        creditsSpent: r.credits_spent,
        metaAttribution: r.meta_attribution !== null && META.includes(r.meta_attribution) ? (r.meta_attribution as MetaAttribution) : null,
        referralStatus: r.referral_status,
        fromLeadShare: r.from_lead_share,
        team: r.owns_internal || isAdminEmail(r.email),
      });
    }
    if (page.length < PAGE) break;
  }
  return { data: rows, error: null };
}
