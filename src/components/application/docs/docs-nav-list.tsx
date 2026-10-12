"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsNavCollection } from "@/lib/docs/types";
import { COLLECTION_ICON } from "./collection-icons";
import { cx } from "@/utils/cx";

/**
 * Collections with their articles as plain links. The current page is marked
 * with `aria-current`; collections are always expanded so every article is
 * one click away and search engines see the whole tree.
 */
export function DocsNavList({ nav, onNavigate }: { nav: readonly DocsNavCollection[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Help center" className="flex flex-col gap-5">
      {nav.map((c) => {
        const Icon = COLLECTION_ICON[c.slug];
        const collectionActive = pathname === c.href;
        return (
          <div key={c.slug} className="flex flex-col gap-1">
            <Link
              href={c.href}
              onClick={onNavigate}
              aria-current={collectionActive ? "page" : undefined}
              className={cx(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                collectionActive ? "bg-background-secondary-default text-text-primary" : "text-text-primary hover:bg-background-secondary-hover",
              )}
            >
              <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
              <span className="text-body-medium">{c.title}</span>
            </Link>
            <ul className="ms-4 flex flex-col gap-0.5 border-s border-separator-border ps-2">
              {c.articles.map((a) => {
                const active = pathname === a.href;
                return (
                  <li key={a.slug}>
                    <Link
                      href={a.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "block rounded-lg px-2 py-1.5 outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                        active ? "bg-background-secondary-default text-body-medium text-text-primary" : "text-body-regular text-text-secondary hover:bg-background-secondary-hover hover:text-text-primary",
                      )}
                    >
                      {a.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
