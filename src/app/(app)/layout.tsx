import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/queries";
import { AppHeader } from "@/components/application/header/app-header";

/**
 * Signed-in shell. `proxy.ts` already bounced anonymous requests to /login;
 * here we verify the user, load the workspace context and gate onboarding.
 * Day 1 ships a minimal header; the full header lands on day 2.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        name={session.profile.full_name ?? session.email}
        email={session.email}
        avatarUrl={session.profile.avatar_url}
        workspaceName={session.workspace.name}
        credits={session.creditsAvailable}
      />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 md:px-6 lg:px-10">{children}</main>
    </div>
  );
}
