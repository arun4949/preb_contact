"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/base/banner/banner";
import { Sheet } from "@/components/base/sheet/sheet";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { useColumnVisibility } from "@/components/application/list-detail/columns";
import { ContactsTable } from "@/components/application/list-detail/contacts-table";
import { ContactsToolbar } from "@/components/application/list-detail/contacts-toolbar";
import { EnrichingPanel } from "@/components/application/list-detail/enriching-panel";
import { activeFilterCount, FilterRail } from "@/components/application/list-detail/filter-rail";
import { ListStats } from "@/components/application/list-detail/list-stats";
import { useContactQuery } from "@/components/application/list-detail/use-contact-query";
import type { LeadOwnerView } from "@/lib/leads/owners";
import { trackLeadView } from "@/lib/leads/public-actions";
import type { ContactQuery } from "@/lib/lists/contact-query";
import type { ContactsPage, ListEta } from "@/lib/lists/queries";
import type { ListRow } from "@/lib/supabase/queries";
import { LeadListHeader } from "./lead-list-header";
import { LeadOfferDialog } from "./lead-offer-dialog";

const POLL_MS = 5000;
const viewedTokens = new Set<string>();

export interface LeadViewProps {
  token: string;
  shareId: string;
  list: ListRow;
  contacts: ContactsPage;
  query: ContactQuery;
  eta: ListEta;
  extras: string[];
  owner: LeadOwnerView;
  leadFirstName: string;
  isAdmin: boolean;
  revoked: boolean;
}

/**
 * The unlocked lead page: the same stats, toolbar, filter rail and table a
 * customer sees on /lists/[id], minus every account action. Anonymous
 * visitors cannot hold a realtime socket (RLS), so a running list polls.
 */
export function LeadView({ token, shareId, list, contacts, query, eta, extras, owner, leadFirstName, isAdmin, revoked }: LeadViewProps) {
  const router = useRouter();
  const running = LIST_STATUS_META[list.status].running;
  const paused = list.status === "paused_credits" || list.status === "paused_upstream" || list.status === "failed";
  const { set, reset, pending } = useContactQuery(query);
  const { visibility, toggle, resetColumns } = useColumnVisibility(list.enrich_fields, extras);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const refreshing = useRef(false);

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

  // One "viewed" event per page load (not for admin previews). The module-level
  // set keeps React's development double-mount from counting twice.
  useEffect(() => {
    if (isAdmin || viewedTokens.has(token)) return;
    viewedTokens.add(token);
    void trackLeadView(token);
  }, [isAdmin, token]);

  const filtered = activeFilterCount(query) > 0 || query.q.trim().length > 0;

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      {isAdmin && revoked ? (
        <Banner tone="warning" title="This link is revoked">
          Only admins can see this page right now. Restore the link on the Leads page to open it for the lead again.
        </Banner>
      ) : null}

      <LeadListHeader token={token} list={list} owner={owner} leadFirstName={leadFirstName} />

      {running || paused ? <EnrichingPanel list={list} eta={eta} variant="public" /> : <ListStats list={list} />}

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
          <ContactsTable rows={contacts.rows} total={contacts.total} totalPages={contacts.totalPages} query={query} onChange={set} visibility={visibility} extras={extras} running={running} pending={pending} filtered={filtered} />
        </div>
      </div>

      <Sheet isOpen={filtersOpen} onOpenChange={setFiltersOpen} title="Filters">
        <FilterRail
          list={list}
          query={query}
          onChange={(patch) => set(patch)}
          onReset={() => {
            reset();
            setFiltersOpen(false);
          }}
        />
      </Sheet>

      {!isAdmin ? <LeadOfferDialog token={token} shareId={shareId} owner={owner} /> : null}
    </div>
  );
}
