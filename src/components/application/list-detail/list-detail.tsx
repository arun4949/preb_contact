"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/base/sheet/sheet";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import type { ContactQuery } from "@/lib/lists/contact-query";
import type { ContactsPage, ListEta } from "@/lib/lists/queries";
import type { ListRow } from "@/lib/supabase/queries";
import { createClient } from "@/utils/supabase/client";
import { useColumnVisibility } from "./columns";
import { ContactsTable } from "./contacts-table";
import { ContactsToolbar } from "./contacts-toolbar";
import { EnrichingPanel } from "./enriching-panel";
import { activeFilterCount, FilterRail } from "./filter-rail";
import { ListDetailHeader } from "./list-detail-header";
import { ListStats } from "./list-stats";
import { useContactQuery } from "./use-contact-query";

const POLL_MS = 5000;

export interface ListDetailProps {
  list: ListRow;
  contacts: ContactsPage;
  query: ContactQuery;
  eta: ListEta;
  extras: string[];
  canDelete: boolean;
}

/**
 * Client shell of `/lists/[id]`: realtime on the `lists` row + a 5 s refetch
 * while running (both just call `router.refresh()` so the server component
 * re-queries), filter sheet below `lg`, column visibility per user.
 */
export function ListDetail({ list, contacts, query, eta, extras, canDelete }: ListDetailProps) {
  const router = useRouter();
  const running = LIST_STATUS_META[list.status].running;
  const paused = list.status === "paused_credits" || list.status === "paused_upstream" || list.status === "failed";
  const done = list.status === "completed" || list.status === "stopped";
  const { set, reset, pending } = useContactQuery(query);
  const { visibility, toggle, resetColumns } = useColumnVisibility(list.enrich_fields, extras);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const refreshing = useRef(false);

  // Debounced refresh: never stack refreshes while one is in flight.
  const refresh = () => {
    if (refreshing.current) return;
    refreshing.current = true;
    router.refresh();
    setTimeout(() => (refreshing.current = false), 1500);
  };

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    // A background tab skips the poll; catch up as soon as it is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, list.id]);

  useEffect(() => {
    if (done) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`list:${list.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lists", filter: `id=eq.${list.id}` }, () => refresh())
      // The engine may finish (e.g. an all-cached list) before the channel is open;
      // one refresh on connect closes that gap.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id, done]);

  const filtered = activeFilterCount(query) > 0 || query.q.trim().length > 0;

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <ListDetailHeader list={list} canDelete={canDelete} />

      {running || paused ? <EnrichingPanel list={list} eta={eta} /> : <ListStats list={list} />}

      <ContactsToolbar
        total={list.total_rows}
        q={query.q}
        onSearch={(q) => set({ q })}
        visibility={visibility}
        onToggleColumn={toggle}
        onResetColumns={resetColumns}
        extras={extras}
        enrichFields={list.enrich_fields}
        onOpenFilters={() => setFiltersOpen(true)}
        activeFilters={activeFilterCount(query)}
      />

      <div className="flex items-start gap-6">
        <FilterRail list={list} query={query} onChange={set} onReset={reset} className="hidden w-[260px] shrink-0 rounded-3xl border border-border-button-default bg-background-primary-default p-5 lg:flex" />
        <div className="min-w-0 flex-1">
          <ContactsTable
            rows={contacts.rows}
            total={contacts.total}
            totalPages={contacts.totalPages}
            query={query}
            onChange={set}
            visibility={visibility}
            extras={extras}
            running={running}
            pending={pending}
            filtered={filtered}
          />
        </div>
      </div>

      <Sheet isOpen={filtersOpen} onOpenChange={setFiltersOpen} title="Filters">
        <FilterRail
          list={list}
          query={query}
          onChange={(patch) => {
            set(patch);
          }}
          onReset={() => {
            reset();
            setFiltersOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}
