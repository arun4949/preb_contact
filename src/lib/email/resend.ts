import "server-only";

import type { ReactElement } from "react";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

/**
 * All outbound email goes through Resend with templates owned by this app
 * (`src/lib/email/templates/*`). Supabase Auth never sends mail: sign-in
 * tokens are generated with the admin API and delivered by `sendEmail`.
 */
export type EmailKind = Database["public"]["Enums"]["email_kind"];

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Preb <notifications@preb.co>";

let client: Resend | null = null;
function resend() {
  if (!client) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    client = new Resend(key);
  }
  return client;
}

/** Per-address cap per kind in the last hour. */
const HOURLY_LIMIT: Partial<Record<EmailKind, number>> = { magic_link: 5, invite: 10 };

export async function isRateLimited(email: string, kind: EmailKind): Promise<boolean> {
  const limit = HOURLY_LIMIT[kind];
  if (!limit) return false;
  const admin = createAdminClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_sends")
    .select("id", { count: "exact", head: true })
    .ilike("email", email)
    .eq("kind", kind)
    .gte("sent_at", since);
  return (count ?? 0) >= limit;
}

export async function sendEmail({
  to,
  subject,
  kind,
  react,
  workspaceId,
  from = EMAIL_FROM,
}: {
  to: string;
  subject: string;
  kind: EmailKind;
  react: ReactElement;
  workspaceId?: string | null;
  from?: string;
}): Promise<{ id: string | null }> {
  const { data, error } = await resend().emails.send({ from, to, subject, react });
  if (error) throw new Error(`Email send failed: ${error.message}`);

  const admin = createAdminClient();
  await admin.from("email_sends").insert({
    email: to.toLowerCase(),
    kind,
    provider_message_id: data?.id ?? null,
    workspace_id: workspaceId ?? null,
  });
  return { id: data?.id ?? null };
}
