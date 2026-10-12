"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RiSearchLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { InputBase, TextField } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { SEARCH_SHORTCUT_ATTR } from "@/components/application/header/use-shortcuts";
import { CONTACT_PATH, SEARCH_INDEX } from "@/lib/docs/registry";
import { searchDocs } from "@/lib/docs/search";
import { useDismissOnOutsidePress } from "@/utils/use-dismiss-on-outside-press";
import { cx } from "@/utils/cx";

export interface DocsSearchProps {
  size?: "small" | "medium";
  /** Hides the `/` hint, for example inside the mobile sheet. */
  hideShortcut?: boolean;
  /** Called after a result was chosen (the mobile sheet closes itself). */
  onNavigate?: () => void;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Client-side search over every article: title, keywords, summary and body.
 * A listbox under the field, arrow keys move, Enter opens, Escape clears.
 */
export function DocsSearch({ size = "medium", hideShortcut = false, onNavigate, className, autoFocus }: DocsSearchProps) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchDocs(SEARCH_INDEX, query), [query]);
  const showPanel = open && query.trim().length > 0;
  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutsidePress(showPanel, close, [rootRef]);

  const go = (href: string) => {
    setQuery("");
    setOpen(false);
    onNavigate?.();
    router.push(href);
  };

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <TextField
        aria-label="Search help articles"
        size={size}
        value={query}
        onChange={(v) => {
          setQuery(v);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showPanel) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (hits.length ? (a + 1) % hits.length : 0));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (hits.length ? (a - 1 + hits.length) % hits.length : 0));
          } else if (e.key === "Enter") {
            if (hits[active]) {
              e.preventDefault();
              go(hits[active].href);
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            setQuery("");
            setOpen(false);
          }
        }}
        {...{ [SEARCH_SHORTCUT_ATTR]: "" }}
      >
        <InputBase
          placeholder="Search help articles…"
          leadingIcon={RiSearchLine}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && hits[active] ? `${listId}-${hits[active].slug}` : undefined}
          aria-autocomplete="list"
          fieldClassName={cx(!hideShortcut && "sm:pe-9", size === "medium" && "h-11 rounded-xl px-3")}
        />
      </TextField>
      {!hideShortcut ? (
        <Kbd className="pointer-events-none absolute top-1/2 end-2.5 hidden -translate-y-1/2 sm:inline-flex" aria-hidden>
          /
        </Kbd>
      ) : null}
      {showPanel ? (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-xs">
          {hits.length ? (
            <ul id={listId} role="listbox" aria-label="Search results" className="flex max-h-[min(420px,60dvh)] flex-col overflow-y-auto p-1.5">
              {hits.map((hit, i) => (
                <li key={hit.slug} id={`${listId}-${hit.slug}`} role="option" aria-selected={i === active}>
                  <Link
                    href={hit.href}
                    tabIndex={-1}
                    onMouseEnter={() => setActive(i)}
                    onClick={(e) => {
                      e.preventDefault();
                      go(hit.href);
                    }}
                    className={cx("flex flex-col gap-0.5 rounded-xl px-3 py-2 outline-none transition-colors duration-150 ease", i === active ? "bg-background-secondary-default" : "hover:bg-background-secondary-hover")}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-body-medium text-text-primary">{hit.title}</span>
                      <Chip variant="caption" color="soft" className="shrink-0">
                        {hit.collectionTitle}
                      </Chip>
                    </span>
                    <span className="line-clamp-2 text-caption-1-regular text-text-secondary">{hit.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div id={listId} role="listbox" className="flex flex-col gap-1 px-4 py-4">
              <span className="text-body-medium text-text-primary">No articles match.</span>
              <span className="text-body-2-regular text-text-secondary">
                Try another word, or{" "}
                <Link href={CONTACT_PATH} onClick={() => go(CONTACT_PATH)} className="text-accent-600 underline-offset-3 hover:underline">
                  contact support
                </Link>
                .
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
