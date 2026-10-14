import "server-only";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_REF_COOKIE } from "./constants";
import { logShareEvent } from "./events";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Only a brand-new account counts as a conversion; an old customer who clicks the link is not one. */
const FRESH_ACCOUNT_MS = 60 * 60_000;

/**
 * Called once after a new account finished signing up (onboarding, or the
 * invitee path). Reads the `preb_lead_ref` cookie the public page set, marks
 * the share as converted once and clears the cookie. Never throws.
 */
export async function attributeLeadSignup(userId: string): Promise<void> {
  try {
    const jar = await cookies();
    const ref = jar.get(LEAD_REF_COOKIE)?.value;
    if (!ref) return;
    jar.delete(LEAD_REF_COOKIE);
    if (!UUID.test(ref)) return;

    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("created_at").eq("id", userId).maybeSingle();
    if (!profile || Date.now() - new Date(profile.created_at).getTime() > FRESH_ACCOUNT_MS) return;

    const { data: updated } = await admin
      .from("lead_shares")
      .update({ signed_up_user_id: userId, signed_up_at: new Date().toISOString() })
      .eq("id", ref)
      .is("signed_up_user_id", null)
      .select("id");
    if (updated?.length) await logShareEvent(admin, ref, "signed_up");
  } catch (error) {
    console.error("[attributeLeadSignup] failed", error instanceof Error ? error.message : error);
  }
}
