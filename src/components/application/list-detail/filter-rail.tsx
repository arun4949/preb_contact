"use client";

import { RiFilter3Line, RiMailLine, RiPhoneLine, RiUserUnfollowLine } from "@remixicon/react";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import type { ContactQuery } from "@/lib/lists/contact-query";
import type { Segment } from "@/lib/lists/segments";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";
import type { QueryPatch } from "./use-contact-query";

const fmt = (n: number) => n.toLocaleString("en-US");

export interface FilterRailProps {
  list: ListRow;
  query: ContactQuery;
  onChange: (patch: QueryPatch) => void;
  onReset: () => void;
  className?: string;
}

export function activeFilterCount(query: ContactQuery): number {
  return (query.email !== "all" ? 1 : 0) + (query.phone ? 1 : 0);
}

function Pill({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-body-2-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        selected
          ? "border-accent-600 bg-accent-600 text-white hover:bg-accent-700"
          : "border-border-button-default bg-background-primary-default text-text-secondary hover:border-border-button-hover hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

/** Left rail (≥ lg) or sheet body (below): Email status · Phone status · Duplicates removed. */
export function FilterRail({ list, query, onChange, onReset, className }: FilterRailProps) {
  const processed = Math.max(list.processed_rows, list.found_work_email + list.risky_email);
  const valid = list.found_work_email;
  const risky = list.risky_email;
  const notFound = Math.max(0, processed - valid - risky);
  const phoneFound = list.found_phone;
  const phoneNotFound = Math.max(0, processed - phoneFound);
  const wantsPhone = list.enrich_fields.includes("mobile_phone");
  const base = processed || 1;

  const toggleEmail = (s: Segment) => onChange({ email: query.email === s ? "all" : s });
  const togglePhone = (p: "found" | "not_found") => onChange({ phone: query.phone === p ? null : p });

  return (
    <aside className={cx("flex flex-col gap-6", className)} aria-label="Filters">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-body-medium text-text-primary">
          <RiFilter3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
          Filters
        </span>
        <Button variant="ghost" size="xs" onClick={onReset} disabled={activeFilterCount(query) === 0 && !query.q}>
          Reset
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-body-medium text-text-primary">
          <RiMailLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          Email status
        </h3>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-background-tertiary-default" role="img" aria-label={`${fmt(valid)} valid, ${fmt(risky)} risky, ${fmt(notFound)} not found`}>
          <span className="h-full bg-chart-1 transition-[width] duration-500" style={{ width: `${(valid / base) * 100}%` }} />
          <span className="h-full bg-chart-3 transition-[width] duration-500" style={{ width: `${(risky / base) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill selected={query.email === "valid"} onClick={() => toggleEmail("valid")}>
            <span className="size-2 rounded-full bg-chart-1" aria-hidden /> Valid <span className="tabular-nums opacity-80">{fmt(valid)}</span>
          </Pill>
          <Pill selected={query.email === "risky"} onClick={() => toggleEmail("risky")}>
            <span className="size-2 rounded-full bg-chart-3" aria-hidden /> Risky <span className="tabular-nums opacity-80">{fmt(risky)}</span>
          </Pill>
          <Pill selected={query.email === "not_found"} onClick={() => toggleEmail("not_found")}>
            Not found <span className="tabular-nums opacity-80">{fmt(notFound)}</span>
          </Pill>
        </div>
      </section>

      {wantsPhone ? (
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-body-medium text-text-primary">
            <RiPhoneLine className="size-4 text-foreground-icon-secondary" aria-hidden />
            Phone status
          </h3>
          <div className="flex flex-wrap gap-2">
            <Pill selected={query.phone === "found"} onClick={() => togglePhone("found")}>
              Found <span className="tabular-nums opacity-80">{fmt(phoneFound)}</span>
            </Pill>
            <Pill selected={query.phone === "not_found"} onClick={() => togglePhone("not_found")}>
              Not found <span className="tabular-nums opacity-80">{fmt(phoneNotFound)}</span>
            </Pill>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-separator-border pt-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-body-regular text-text-secondary">
            <RiUserUnfollowLine className="size-4 text-foreground-icon-secondary" aria-hidden />
            Duplicates removed
          </span>
          <Badge>{fmt(list.duplicates_removed)}</Badge>
        </div>
        {list.cached_rows > 0 ? (
          <div className="flex items-center justify-between">
            <span className="text-body-regular text-text-secondary">Already enriched (free)</span>
            <Badge>{fmt(list.cached_rows)}</Badge>
          </div>
        ) : null}
      </section>
    </aside>
  );
}
