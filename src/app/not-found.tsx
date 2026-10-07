import type { Metadata } from "next";
import Link from "next/link";
import { RiCompass3Line } from "@remixicon/react";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { LogoName } from "@/components/foundations/brand/logo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Link href="/" aria-label="Preb home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <LogoName height={28} />
      </Link>
      <main className="w-full max-w-[480px] rounded-3xl border border-border-button-default bg-background-primary-default shadow-xs animate-page-enter">
        <EmptyState
          icon={RiCompass3Line}
          title="Page not found"
          description="The link may be outdated, or the list was deleted."
          actions={<ButtonLink href="/lists">Go to your lists</ButtonLink>}
        />
      </main>
    </div>
  );
}
