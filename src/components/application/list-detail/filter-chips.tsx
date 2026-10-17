"use client";

import { RiMailLine, RiSmartphoneLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { activeFilterCount, type ContactQuery } from "@/lib/lists/contact-query";
import { EMAIL_LEVEL_META } from "@/lib/lists/email-levels";
import { type ListInsights } from "@/lib/lists/insights";
import { EMAIL_FILTERS, type EmailFilter } from "@/lib/lists/segments";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";
import type { QueryPatch } from "./use-contact-query";

const fmt = (n: number) => n.toLocaleString("en-US");

export interface FilterChipsProps {
  list: Pick<ListRow, "enrich_fields">;
  insights: ListInsights;
  query: ContactQuery;
  onChange: (patch: QueryPatch) => void;
  onReset: () => void;
  className?: string;
}

export function Pill({ selected, onClick, swatch, children }: { selected: boolean; onClick: () => void; swatch?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body-2-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
        selected
          ? "border-accent-600 bg-accent-600 text-white hover:bg-accent-700"
          : "border-border-button-default bg-background-primary-default text-text-secondary hover:border-border-button-hover hover:text-text-primary",
      )}
    >
      {swatch ? <span className={cx("size-2 rounded-full", selected ? "bg-white/80" : swatch)} aria-hidden /> : null}
      {children}
    </button>
  );
}

/**
 * One row above the table: email level chips (All, Valid, Probably valid,
 * Catch-all, Not found) with their counts, phone chips when a mobile number
 * was ordered, and Reset. The counts come from the same breakdown as the
 * summary cards, so chips and rings always agree.
 */
export function FilterChips({ list, insights, query, onChange, onReset, className }: FilterChipsProps) {
  const wantsPhone = list.enrich_fields.includes("mobile_phone");
  const w = insights.work_email;
  const emailCount: Record<EmailFilter, number> = { all: insights.processed, valid: w.valid, probable: w.probable, catch_all: w.catch_all, not_found: w.not_found };
  const toggleEmail = (f: EmailFilter) => onChange({ email: f === "all" || query.email === f ? "all" : f });
  const togglePhone = (p: "found" | "not_found") => onChange({ phone: query.phone === p ? null : p });
  const active = activeFilterCount(query) > 0;

  return (
    <div className={cx("flex flex-wrap items-center gap-x-4 gap-y-2", className)} role="group" aria-label="Filters">
      <div className="flex flex-wrap items-center gap-2">
        <span className="me-0.5 inline-flex items-center gap-1.5 text-body-2-medium text-text-tertiary">
          <RiMailLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
          Work email
        </span>
        {EMAIL_FILTERS.map((f) => (
          <Pill key={f.id} selected={f.id === "all" ? query.email === "all" : query.email === f.id} onClick={() => toggleEmail(f.id)} swatch={f.id === "all" ? undefined : EMAIL_LEVEL_META[f.id].chart}>
            {f.label}
            <span className="tabular-nums opacity-70">{fmt(emailCount[f.id])}</span>
          </Pill>
        ))}
      </div>

      {wantsPhone ? (
        <div className="flex flex-wrap items-center gap-2 border-s border-separator-border ps-4">
          <span className="me-0.5 inline-flex items-center gap-1.5 text-body-2-medium text-text-tertiary">
            <RiSmartphoneLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
            Phone
          </span>
          <Pill selected={query.phone === "found"} onClick={() => togglePhone("found")}>
            Found <span className="tabular-nums opacity-70">{fmt(insights.phone.found)}</span>
          </Pill>
          <Pill selected={query.phone === "not_found"} onClick={() => togglePhone("not_found")}>
            Not found <span className="tabular-nums opacity-70">{fmt(insights.phone.not_found)}</span>
          </Pill>
        </div>
      ) : null}

      {active || query.q ? (
        <Button variant="ghost" size="xs" onClick={onReset} className="ms-auto">
          Reset
        </Button>
      ) : null}
    </div>
  );
}
