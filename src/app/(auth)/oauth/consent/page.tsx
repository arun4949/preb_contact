import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RiLinksLine } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { createClient } from "@/utils/supabase/server";
import { getProfile, getUser } from "@/lib/supabase/queries";
import { assistantFromClientName } from "@/lib/mcp/clients";
import { OAUTH_CONSENT_PATH } from "@/lib/mcp/config";
import { ConsentCard, type ConsentWorkspace } from "./consent-card";

export const metadata: Metadata = { title: "Connect your assistant", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * OAuth consent screen (Supabase dashboard: Authentication > OAuth Server >
 * Authorization Path = /oauth/consent). An AI assistant that wants to use
 * Preb sends the user here with an `authorization_id`; the proxy bounces
 * signed-out visitors through /login and back. The user picks the workspace
 * the assistant may work in and approves.
 */
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const params = await searchParams;
  const authorizationId = typeof params.authorization_id === "string" ? params.authorization_id.trim() : "";
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`${OAUTH_CONSENT_PATH}${authorizationId ? `?authorization_id=${authorizationId}` : ""}`)}`);

  if (!authorizationId) return <NothingToApprove />;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) return <NothingToApprove expired />;
  // Already approved for this client: Supabase hands back the code right away.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const [profile, { data: memberships }] = await Promise.all([
    getProfile(),
    supabase.from("workspace_members").select("role, workspace:workspaces(id, name)").eq("user_id", user.id),
  ]);
  const workspaces: ConsentWorkspace[] = (memberships ?? [])
    .filter((m) => m.workspace)
    .map((m) => ({ id: m.workspace!.id, name: m.workspace!.name, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (workspaces.length === 0) redirect("/onboarding");
  const defaultWorkspaceId = workspaces.find((w) => w.id === profile?.default_workspace_id)?.id ?? workspaces[0].id;

  const assistant = assistantFromClientName(data.client.name);
  let redirectHost = "";
  try {
    redirectHost = new URL(data.redirect_uri).host;
  } catch {}

  return (
    <ConsentCard
      authorizationId={data.authorization_id}
      client={{ id: data.client.id, name: data.client.name, redirectHost }}
      assistant={assistant}
      email={user.email ?? data.user.email}
      workspaces={workspaces}
      defaultWorkspaceId={defaultWorkspaceId}
    />
  );
}

function NothingToApprove({ expired = false }: { expired?: boolean }) {
  return (
    <div className="flex w-full max-w-[440px] flex-col rounded-3xl border border-border-button-default bg-background-primary-default p-6 shadow-xs sm:p-8">
      <span className="mb-5 flex size-12 items-center justify-center rounded-full bg-background-secondary-default">
        <RiLinksLine className="size-6 text-foreground-icon-primary" aria-hidden />
      </span>
      <h1 className="text-title-2-medium text-text-primary">{expired ? "This request has expired" : "Nothing to approve"}</h1>
      <p className="mt-1.5 text-body-regular text-text-secondary">
        {expired
          ? "The sign-in request from your assistant is no longer valid. Go back to your assistant and start the connection again. The Integrations page explains every step."
          : "This page opens when an AI assistant such as Claude or ChatGPT asks to connect to Preb. Start the connection in your assistant and you will be sent here."}
      </p>
      <ButtonLink href="/integrations" className="mt-6 w-full">
        Open Integrations
      </ButtonLink>
    </div>
  );
}
