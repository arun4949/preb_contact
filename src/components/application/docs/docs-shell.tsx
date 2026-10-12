"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiMenuLine, RiSearchLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { ScrollFade } from "@/components/base/scroll-fade/scroll-fade";
import { Sheet } from "@/components/base/sheet/sheet";
import { ThemeToggle } from "@/components/application/theme/theme-toggle";
import { Logo, LogoName } from "@/components/foundations/brand/logo";
import { DOCS_PATH } from "@/lib/site-links";
import type { DocsNavCollection } from "@/lib/docs/types";
import { DocsNavList } from "./docs-nav-list";
import { DocsSearch } from "./docs-search";
import { useDocsShortcuts } from "./use-docs-shortcuts";

/**
 * Public help center frame: sticky header (logo, search, theme, Open app),
 * a sticky sidebar from `lg`, and a start-side Sheet with search and nav on
 * phones. The signed-in AppHeader never renders here; the docs live in their
 * own route group.
 */
export function DocsShell({ nav, children }: { nav: readonly DocsNavCollection[]; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useDocsShortcuts();
  const isHome = pathname === DOCS_PATH;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-separator-border bg-background-primary-default">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Button iconOnly variant="ghost" leadingIcon={RiMenuLine} aria-label="Open help center menu" className="lg:hidden" onClick={() => setMenuOpen(true)} />
            <Link href={DOCS_PATH} aria-label="Preb help center" className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              <span className="hidden items-center sm:flex">
                <LogoName height={24} />
              </span>
              <Logo size={28} className="sm:hidden" />
              <span className="hidden text-body-regular text-text-tertiary sm:inline" aria-hidden>
                /
              </span>
              <span className="text-body-medium text-text-secondary">Help center</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {!isHome ? <DocsSearch size="small" className="hidden w-[280px] md:block xl:w-[340px]" /> : null}
            <Button iconOnly variant="ghost" leadingIcon={RiSearchLine} aria-label="Search help articles" className="md:hidden" onClick={() => setMenuOpen(true)} />
            <ThemeToggle appearance="segmented" size="small" className="hidden sm:flex" />
            <ButtonLink href="/lists" variant="secondary" size="small">
              Open app
            </ButtonLink>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-8 md:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10 lg:px-10 lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <ScrollFade surfaceClassName="from-background-full" className="max-h-[calc(100dvh-7rem)] pb-6 pe-2">
              <DocsNavList nav={nav} />
            </ScrollFade>
          </div>
        </aside>
        <div className="min-w-0 animate-page-enter">{children}</div>
      </div>

      <Sheet isOpen={menuOpen} onOpenChange={setMenuOpen} side="start" title="Help center">
        <div className="flex flex-col gap-5">
          <DocsSearch size="medium" hideShortcut autoFocus onNavigate={() => setMenuOpen(false)} />
          <DocsNavList nav={nav} onNavigate={() => setMenuOpen(false)} />
          <div className="flex items-center justify-between gap-2 border-t border-separator-border pt-4 sm:hidden">
            <span className="text-body-medium text-text-primary">Theme</span>
            <ThemeToggle appearance="segmented" size="small" />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
