import { RiLinkUnlinkM } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { LogoName } from "@/components/foundations/brand/logo";
import { MARKETING_SITE_URL } from "@/lib/site-links";

/** Unknown, revoked or deleted share link. Says nothing about which. */
export function LeadUnavailable() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <a href={MARKETING_SITE_URL} aria-label="Preb website" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <LogoName height={28} />
      </a>
      <main className="w-full max-w-[480px] rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs animate-page-enter">
        <EmptyState
          icon={RiLinkUnlinkM}
          title="This link is no longer available"
          description="The shared list may have been closed by the person who sent it. Ask them for a new link, or create your own enriched list with Preb."
          actions={<ButtonLink href="/login">Open Preb</ButtonLink>}
        />
      </main>
    </div>
  );
}
