"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RiAddLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Kbd } from "@/components/base/kbd/kbd";
import { Tab, TabList, Tabs } from "@/components/base/tabs/tabs";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { Logo, LogoName } from "@/components/foundations/brand/logo";
import type { CreditSummary } from "@/lib/supabase/queries";
import { AccountDropdown, type AccountDropdownProps } from "./account-dropdown";
import { CreditsDropdown } from "./credits-dropdown";
import { useGlobalShortcuts } from "./use-shortcuts";

export interface AppHeaderProps extends AccountDropdownProps {
  credits: CreditSummary;
}

const NAV = [
  { id: "lists", label: "Lists", href: "/lists" },
  { id: "enrich", label: "Enrich", href: "/enrich" },
] as const;

/**
 * Sticky app bar (Figma 1015:30): logo + wordmark, underline tabs (Lists,
 * Enrich), New list, credits dropdown, account dropdown. Mobile keeps the
 * logo mark, both tabs, an icon-only New list and the avatar.
 */
export function AppHeader({ credits, ...account }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  useGlobalShortcuts();
  const routeTab = NAV.find((t) => pathname.startsWith(t.href))?.id ?? "lists";
  // The underline moves on click, not when the server answers. The optimistic
  // pick is tied to the pathname it was made on, so it expires by itself once
  // the route changes (derived state, no effect).
  const [optimistic, setOptimistic] = useState<{ tab: string; from: string } | null>(null);
  const selected = optimistic && optimistic.from === pathname ? optimistic.tab : routeTab;
  useEffect(() => {
    NAV.forEach((t) => router.prefetch(t.href));
    router.prefetch("/lists/new");
  }, [router]);

  return (
    <header className="sticky top-0 z-40 border-b border-separator-border bg-background-primary-default">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-4 px-4 md:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-6">
          <Link
            href="/lists"
            aria-label="Preb, go to lists"
            className="flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <span className="hidden items-center sm:flex">
              <LogoName height={24} />
            </span>
            <Logo size={28} className="sm:hidden" />
          </Link>
          <Tabs
            selectedKey={selected}
            onSelectionChange={(key) => {
              const target = NAV.find((t) => t.id === key);
              if (!target || target.id === selected) return;
              setOptimistic({ tab: target.id, from: pathname });
              startTransition(() => router.push(target.href));
            }}
            className="flex h-16 w-auto justify-end"
          >
            <TabList aria-label="Main navigation" className="h-16 border-b-0">
              {NAV.map((t) => (
                <Tab key={t.id} id={t.id} className="h-full">
                  {t.label}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <TooltipTrigger>
            <ButtonLink href="/lists/new" leadingIcon={RiAddLine} className="hidden rounded-full sm:inline-flex">
              New list
            </ButtonLink>
            <Tooltip>
              New list <Kbd className="ms-1">N</Kbd>
            </Tooltip>
          </TooltipTrigger>
          <Button
            iconOnly
            leadingIcon={RiAddLine}
            aria-label="New list"
            className="rounded-full sm:hidden"
            onClick={() => router.push("/lists/new")}
          />
          <CreditsDropdown summary={credits} />
          <AccountDropdown {...account} />
        </div>
      </div>
    </header>
  );
}
