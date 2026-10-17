"use client";

import type { ComponentType } from "react";
import { RiCoinLine, RiGroupLine, RiHistoryLine, RiUserUnfollowLine } from "@remixicon/react";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";

const fmt = (n: number) => n.toLocaleString("en-US");

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

function Pill({ icon: IconCmp, title, children }: { icon: Icon; title: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-background-secondary-default px-2.5 text-body-2-medium text-text-secondary tabular-nums" title={title}>
      <IconCmp className="size-3.5 text-foreground-icon-secondary" aria-hidden />
      {children}
    </span>
  );
}

/**
 * The list's bookkeeping in one quiet row under the title: contacts (and how
 * many were processed), credits used, duplicates removed and rows served
 * from the workspace cache. Lives in both the customer header and the lead
 * share header, which hides the credits.
 */
export function ListMetaPills({ list, showCredits = false, className }: { list: ListRow; showCredits?: boolean; className?: string }) {
  const processed = list.processed_rows;
  const enrichable = list.enrichable_rows;
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <Pill icon={RiGroupLine} title="Contacts in the file, and how many were processed">
        {fmt(list.total_rows)} {list.total_rows === 1 ? "contact" : "contacts"}
        {enrichable > 0 && processed !== list.total_rows ? <span className="text-text-tertiary">{fmt(processed)} processed</span> : null}
      </Pill>
      {showCredits ? (
        <Pill icon={RiCoinLine} title="Credits used by this list">
          {fmt(list.credits_used)} credits used
        </Pill>
      ) : null}
      <Pill icon={RiUserUnfollowLine} title="Rows that pointed at the same person as another row">
        {fmt(list.duplicates_removed)} duplicates removed
      </Pill>
      {list.cached_rows > 0 ? (
        <Pill icon={RiHistoryLine} title="Enriched in your workspace within the last 90 days, reused for free">
          {fmt(list.cached_rows)} already enriched
        </Pill>
      ) : null}
    </div>
  );
}
