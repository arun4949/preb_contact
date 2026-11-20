import "server-only";

import { isAdminEmail } from "@/lib/auth/work-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/supabase/queries";
import type { Part } from "./accounts";
import type { AtsRow } from "./signup-ats-stats";
import { signupSourceStatus } from "./signup-source-meta";

/**
 * Data for the ATS view of /admin/insights: everyone who was asked "Which ATS
 * do you use?" in the period, one row each (`admin_signup_ats`, migration
 * 0036). Service-role read across all accounts, so the loader checks the
 * allowlist itself on top of the page guard. A failed query is returned as an
 * error, never as an empty result.
 */

const PAGE = 1000;

export async function getSignupAts(since: string | null): Promise<Part<AtsRow[]>> {
  const session = await getSessionContext();
  if (!session || !isAdminEmail(session.email)) throw new Error("Not allowed");
  const admin = createAdminClient();

  const rows: AtsRow[] = [];
  // PostgREST caps a response at 1000 rows: read every page (the function orders by asked_at, user_id).
  for (let from = 0; from < 100 * PAGE; from += PAGE) {
    const { data, error } = await admin.rpc("admin_signup_ats", since ? { p_since: since } : {}).range(from, from + PAGE - 1);
    if (error) return { data: null, error: `${error.code ? `${error.code} ` : ""}${error.message}` };
    // The generated types mark every column as present; the left joins and optional columns make these nullable.
    const page = (data ?? []) as unknown as (Omit<NonNullable<typeof data>[number], "full_name" | "ats" | "detail" | "responded_at" | "workspace_name" | "plan_key"> & {
      full_name: string | null;
      ats: string | null;
      detail: string | null;
      responded_at: string | null;
      workspace_name: string | null;
      plan_key: string | null;
    })[];
    for (const r of page) {
      rows.push({
        userId: r.user_id,
        email: r.email,
        fullName: r.full_name,
        workspaceName: r.workspace_name,
        status: signupSourceStatus(r.status),
        ats: r.ats,
        detail: r.detail,
        askedAt: r.asked_at,
        respondedAt: r.responded_at,
        paying: r.plan_key !== null,
        creditsSpent: r.credits_spent,
        team: r.owns_internal || isAdminEmail(r.email),
      });
    }
    if (page.length < PAGE) break;
  }
  return { data: rows, error: null };
}
