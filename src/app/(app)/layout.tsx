import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCreditSummary, getProfilePhone, getSessionContext, getUser } from "@/lib/supabase/queries";
import { countryFromAcceptLanguage, toPhoneCountry } from "@/lib/phone/phone";
import { AppHeader } from "@/components/application/header/app-header";
import { SettingsHost } from "@/components/application/settings/settings-host";
import { FeaturebaseIdentity } from "@/components/foundations/featurebase/featurebase";
import { signFeaturebaseJwt } from "@/lib/featurebase/jwt";
import { isAdminEmail } from "@/lib/auth/work-email";
import { getNotifications, getUnreadCount } from "@/lib/notifications/queries";

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
  const [credits, featurebaseJwt, notifications, unreadCount, phone, h] = await Promise.all([
    getCreditSummary(session.workspace, session.creditsAvailable),
    signFeaturebaseJwt(session),
    getNotifications(),
    getUnreadCount(),
    getProfilePhone(),
    headers(),
  ]);
  const defaultCountry = toPhoneCountry(h.get("x-vercel-ip-country") ?? countryFromAcceptLanguage(h.get("accept-language")));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        name={session.profile.full_name ?? session.email}
        email={session.email}
        avatarUrl={session.profile.avatar_url}
        workspaceName={session.workspace.name}
        isAdmin={isAdminEmail(session.email)}
        credits={credits}
        userId={session.userId}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-4 py-8 md:px-6 lg:px-10">{children}</main>
      <Suspense fallback={null}>
        <SettingsHost
          profile={{
            name: session.profile.full_name ?? "",
            email: session.email,
            avatarUrl: session.profile.avatar_url,
            productNews: session.profile.product_news,
            phone: phone ? { e164: phone.phone, country: phone.country, callsAllowed: phone.calls_allowed } : null,
            defaultCountry,
            ownsWorkspace: session.role === "owner",
          }}
        />
      </Suspense>
      <FeaturebaseIdentity jwt={featurebaseJwt} />
    </div>
  );
}
