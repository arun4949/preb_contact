import Link from "next/link";
import { RiCoinLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { LogoName } from "@/components/foundations/brand/logo";
import { signOut } from "@/lib/auth/actions";

/**
 * Day-1 header: logo, credits pill, avatar, sign out. Replaced on day 2 by
 * the full header (tabs, New list, credits dropdown, account dropdown).
 */
export function AppHeader({
  name,
  email,
  avatarUrl,
  workspaceName,
  credits,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  workspaceName: string;
  credits: number;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-separator-border bg-background-primary-default">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
        <Link href="/lists" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring" aria-label="Lists">
          <LogoName height={24} />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border-button-default px-3 py-1.5 text-body-medium text-text-primary sm:inline-flex">
            <RiCoinLine className="size-4 text-foreground-icon-secondary" aria-hidden />
            {credits.toLocaleString("en-US")} credits
          </span>
          <div className="hidden flex-col items-end sm:flex">
            <span className="text-body-medium text-text-primary">{name}</span>
            <span className="text-caption-1-regular text-text-tertiary">{workspaceName}</span>
          </div>
          <Avatar size="md" src={avatarUrl ?? undefined} alt={email} initials={initials} />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="small">
              Log out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
