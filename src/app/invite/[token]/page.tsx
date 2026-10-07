import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RiTeamLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { LogoName } from "@/components/foundations/brand/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/queries";
import { hashInviteToken } from "@/lib/auth/invite";
import { acceptInvite } from "./actions";

export const metadata: Metadata = { title: "You're invited" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("workspace_invites")
    .select("id, email, role, expires_at, accepted_at, invited_by, workspace:workspaces(name)")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  const { data: inviter } = invite
    ? await admin.from("profiles").select("full_name").eq("id", invite.invited_by).maybeSingle()
    : { data: null };

  const shell = (children: ReactNode) => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/" aria-label="Preb home">
        <LogoName height={28} />
      </Link>
      <main className="w-full max-w-[480px] rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs animate-page-enter">
        {children}
      </main>
    </div>
  );

  if (!invite || invite.accepted_at || new Date(invite.expires_at) < new Date()) {
    return shell(
      <EmptyState
        icon={RiTeamLine}
        title="This invite is no longer valid"
        description="It may have expired or already been used. Ask your teammate to send a new one."
        actions={<ButtonLink href="/login" variant="secondary">Go to sign in</ButtonLink>}
      />,
    );
  }

  const user = await getUser();
  const workspaceName = invite.workspace?.name ?? "a workspace";
  const inviterName = inviter?.full_name ?? "A teammate";

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const emailMatches = (user.email ?? "").toLowerCase() === invite.email.toLowerCase();

  return shell(
    <EmptyState
      icon={RiTeamLine}
      title={`${inviterName} invited you to ${workspaceName}`}
      description={
        emailMatches ? (
          <>You&apos;ll join as {invite.role} and share the workspace&apos;s lists and credits.</>
        ) : (
          <>
            This invite was sent to <span className="text-body-medium text-text-primary" dir="ltr">{invite.email}</span>, but you&apos;re signed in as{" "}
            <span className="text-body-medium text-text-primary" dir="ltr">{user.email}</span>. Sign in with the invited address to accept.
          </>
        )
      }
      actions={
        emailMatches ? (
          <form action={acceptInvite}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit">Accept invite</Button>
          </form>
        ) : (
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="secondary">Switch account</Button>
          </form>
        )
      }
    />,
  );
}
