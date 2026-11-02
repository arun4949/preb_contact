"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/queries";
import { assistantFromClientName } from "./clients";

/**
 * The consent screen's two buttons. Approve records which workspace the
 * assistant works in (`mcp_connections`), then lets Supabase Auth issue the
 * authorization code and sends the browser back to the assistant.
 */

export type ConsentState = { status: "idle" } | { status: "error"; message: string };

const RETRY = "Go back to your assistant and start the connection again.";

export async function approveConnection(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const authorizationId = String(formData.get("authorization_id") ?? "").trim();
  const workspaceId = String(formData.get("workspace_id") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim().slice(0, 200);
  const clientName = String(formData.get("client_name") ?? "").trim().slice(0, 120);
  if (!authorizationId || !workspaceId || !clientId) return { status: "error", message: `Something is missing from this request. ${RETRY}` };

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${authorizationId}`)}`);

  const supabase = await createClient();
  // The RLS session client only sees the user's own memberships.
  const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id).eq("workspace_id", workspaceId).maybeSingle();
  if (!membership) return { status: "error", message: "You are not a member of that workspace. Choose another one." };

  const admin = createAdminClient();
  const { error: upsertErr } = await admin
    .from("mcp_connections")
    .upsert({ user_id: user.id, client_id: clientId, workspace_id: workspaceId, client_name: assistantFromClientName(clientName).name === "AI assistant" ? clientName : assistantFromClientName(clientName).name, last_used_at: null }, { onConflict: "user_id,client_id" });
  if (upsertErr) {
    console.error(JSON.stringify({ scope: "mcp", event: "consent.upsert_failed", error: upsertErr.message }));
    return { status: "error", message: `Preb could not save the connection. ${RETRY}` };
  }

  const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) return { status: "error", message: `This sign-in request has expired. ${RETRY}` };
  redirect(data.redirect_url);
}

export async function denyConnection(_prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const authorizationId = String(formData.get("authorization_id") ?? "").trim();
  if (!authorizationId) return { status: "error", message: `Something is missing from this request. ${RETRY}` };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (error || !data?.redirect_url) redirect("/integrations");
  redirect(data.redirect_url);
}
