"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/base/pagination/pagination";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { cx } from "@/utils/cx";

/**
 * Filters, tabs and pagers of the admin account pages keep their state in the
 * query string: the server component re-queries, and reload, back and a shared
 * link all show the same view. A value equal to its default leaves the URL.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const set = useCallback(
    (patch: Record<string, string | null>, mode: "push" | "replace" = "push") => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      start(() => (mode === "push" ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false })));
    },
    [pathname, router, searchParams],
  );

  return { set, pending };
}

export interface UrlPaginationProps {
  /** Query key that holds the page number. */
  param: string;
  page: number;
  totalPages: number;
  "aria-label": string;
  className?: string;
}

/** Pager that writes the page into the URL. Renders nothing for a single page. */
export function UrlPagination({ param, page, totalPages, className, ...props }: UrlPaginationProps) {
  const { set, pending } = useUrlState();
  if (totalPages <= 1) return null;
  return (
    <Pagination
      aria-label={props["aria-label"]}
      page={Math.min(page, totalPages)}
      totalPages={totalPages}
      onChange={(next) => set({ [param]: next === 1 ? null : String(next) })}
      className={cx("transition-opacity", pending && "opacity-70", className)}
    />
  );
}

export interface UrlSegmentedProps {
  param: string;
  value: string;
  /** The option that is the default, and so is left out of the URL. */
  defaultValue: string;
  options: { id: string; label: string }[];
  /** Query keys to clear on change (the pager of the filtered table). */
  reset?: string[];
  "aria-label": string;
}

/** Segmented filter that writes its value into the URL and resets the pager it belongs to. */
export function UrlSegmented({ param, value, defaultValue, options, reset = [], ...props }: UrlSegmentedProps) {
  const { set, pending } = useUrlState();
  return (
    <SegmentedControl
      aria-label={props["aria-label"]}
      selectedKeys={[value]}
      className={cx("transition-opacity", pending && "opacity-70")}
      onSelectionChange={(keys) => {
        const next = [...(keys as Set<string>)][0];
        if (!next || next === value) return;
        set({ [param]: next === defaultValue ? null : next, ...Object.fromEntries(reset.map((key) => [key, null])) });
      }}
    >
      {options.map((option) => (
        <SegmentedControlItem key={option.id} id={option.id}>
          {option.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
