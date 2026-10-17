"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { activeFilterCount, type ContactQuery } from "@/lib/lists/contact-query";
import type { ContactsPage, ListEta, ListInsights } from "@/lib/lists/queries";
import type { ListRow } from "@/lib/supabase/queries";
import { createRealtimeClient } from "@/utils/supabase/realtime";
import { useColumnVisibility } from "./columns";
import { ContactsTable } from "./contacts-table";
import { ContactsToolbar } from "./contacts-toolbar";
import { EnrichingPanel } from "./enriching-panel";
import { FilterChips } from "./filter-chips";
import { ListDetailHeader } from "./list-detail-header";
import { SummaryCards } from "./summary-cards";
import { useContactQuery } from "./use-contact-query";

const POLL_MS = 5000;

export interface ListDetailProps {
  list: ListRow;
  contacts: ContactsPage;
  insights: ListInsights;
  query: ContactQuery;
  eta: ListEta;
  extras: string[];
  canDelete: boolean;
}

/**
 * Client shell of `/lists/[id]`: realtime on the `lists` row + a 5 s refetch
 * while running (both just call `router.refresh()` so the server component
 * re-queries), summary cards, filter chips above the table, column visibility per user.
 */
export function ListDetail({ list, contacts, insights, query, eta, extras, canDelete }: ListDetailProps) {
  const router = useRouter();
  const running = LIST_STATUS_META[list.status].running;
  const paused = list.status === "paused_credits" || list.status === "paused_upstream" || list.status === "failed";
  const done = list.status === "completed" || list.status === "stopped";
  const { query: liveQuery, set, reset, pending } = useContactQuery(query);
  const { visibility, toggle, resetColumns } = useColumnVisibility(list.enrich_fields, extras);
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
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    // The socket needs the user's JWT before joining (RLS), see createRealtimeClient.
    void createRealtimeClient().then((supabase) => {
      if (cancelled) return;
      const channel = supabase
        .channel(`list:${list.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lists", filter: `id=eq.${list.id}` }, () => refresh())
        // The engine may finish (e.g. an all-cached list) before the channel is open;
        // one refresh on connect closes that gap.
        .subscribe((status) => {
          if (status === "SUBSCRIBED") refresh();
        });
      cleanup = () => void supabase.removeChannel(channel);
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id, done]);

  const filtered = activeFilterCount(liveQuery) > 0 || liveQuery.q.trim().length > 0;

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <ListDetailHeader list={list} canDelete={canDelete} />

      {running || paused ? <EnrichingPanel list={list} eta={eta} /> : <SummaryCards list={list} insights={insights} query={liveQuery} onChange={set} />}

      <ContactsToolbar
        total={list.total_rows}
        q={query.q}
        onSearch={(q) => set({ q })}
        visibility={visibility}
        onToggleColumn={toggle}
        onResetColumns={resetColumns}
        extras={extras}
        enrichFields={list.enrich_fields}
      />

      <FilterChips list={list} insights={insights} query={liveQuery} onChange={set} onReset={reset} />

      <ContactsTable
        rows={contacts.rows}
        total={contacts.total}
        totalPages={contacts.totalPages}
        query={liveQuery}
        onChange={set}
        visibility={visibility}
        extras={extras}
        running={running}
        pending={pending}
        filtered={filtered}
      />
    </div>
  );
}
