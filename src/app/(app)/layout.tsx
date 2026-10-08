import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCreditSummary, getSessionContext, getUser } from "@/lib/supabase/queries";
import { AppHeader } from "@/components/application/header/app-header";
import { SettingsHost } from "@/components/application/settings/settings-host";
import { FeaturebaseIdentity } from "@/components/foundations/featurebase/featurebase";
import { signFeaturebaseJwt } from "@/lib/featurebase/jwt";

/**
 * Signed-in shell. `proxy.ts` already bounced anonymous requests to /login;
 * here we verify the user, load the workspace context and render the header.
 * A signed-in user without any workspace (removed from their only one) goes
 * to /onboarding to create a new one instead of looping through /login.
 * A cookie with valid claims but no user behind it (deleted account, stale
 * cookie) is cleared via /auth/signout — redirecting to /login alone would
 * loop, because the proxy only checks the claims.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionContext();
  if (!session) redirect((await getUser()) ? "/onboarding" : "/auth/signout");
  const [credits, featurebaseJwt] = await Promise.all([
    getCreditSummary(session.workspace, session.creditsAvailable),
    signFeaturebaseJwt(session),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        name={session.profile.full_name ?? session.email}
        email={session.email}
        avatarUrl={session.profile.avatar_url}
        workspaceName={session.workspace.name}
        credits={credits}
      />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 md:px-6 lg:px-10">{children}</main>
      <Suspense fallback={null}>
        <SettingsHost profile={{ name: session.profile.full_name ?? "", email: session.email, avatarUrl: session.profile.avatar_url }} />
      </Suspense>
      <FeaturebaseIdentity jwt={featurebaseJwt} />
    </div>
  );
}
