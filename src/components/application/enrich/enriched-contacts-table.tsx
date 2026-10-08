"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RiDownloadLine, RiExternalLinkLine, RiLinkedinBoxLine, RiSearchLine, RiUserSearchLine } from "@remixicon/react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badge";
import { Banner } from "@/components/base/banner/banner";
import { ButtonLink } from "@/components/base/buttons/button";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Input } from "@/components/base/input/input";
import { Pagination } from "@/components/base/pagination/pagination";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { EmailCell, PhoneCell, StatusCell } from "@/components/application/list-detail/contacts-table";
import { SEARCH_SHORTCUT_ATTR } from "@/components/application/header/use-shortcuts";
import type { ManualHistory, ManualRunState } from "@/lib/enrich/queries";
import type { ContactRow } from "@/lib/lists/segments";
import { createClient } from "@/utils/supabase/client";
import { cx } from "@/utils/cx";
import { initialsOf } from "@/utils/initials";

const POLL_MS = 5000;
const fmt = (n: number) => n.toLocaleString("en-US");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const COLUMNS = [
  { id: "name", label: "Name", className: "min-w-[220px]" },
  { id: "job_title", label: "Job title", className: "min-w-[180px]" },
  { id: "company", label: "Company", className: "min-w-[180px]" },
  { id: "work_email", label: "Work email", className: "min-w-[240px]" },
  { id: "personal_email", label: "Personal email", className: "min-w-[220px]" },
  { id: "phone", label: "Mobile", className: "min-w-[180px]" },
  { id: "status", label: "Status", className: "min-w-[140px]" },
  { id: "date", label: "Added", className: "min-w-[90px]" },
] as const;

function displayName(c: ContactRow): string {
  return c.full_name ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || c.linkedin_url?.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "") || "");
}

function isPending(c: ContactRow) {
  return c.status === "pending" || c.status === "submitted";
}

export interface EnrichedContactsTableProps {
  history: ManualHistory;
  runState: ManualRunState;
  q: string;
  workspaceId: string;
}

export function EnrichedContactsTable({ history, runState, q, workspaceId }: EnrichedContactsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(q);
  const refreshing = useRef(false);

  const refresh = () => {
    if (refreshing.current) return;
    refreshing.current = true;
    router.refresh();
    setTimeout(() => (refreshing.current = false), 1500);
  };

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounced search → URL.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null, page: null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // While a manual run is in flight: poll while visible, plus realtime on the workspace's lists.
  useEffect(() => {
    if (!runState.running) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const supabase = createClient();
    const channel = supabase
      .channel(`enrich:${workspaceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lists", filter: `workspace_id=eq.${workspaceId}` }, () => refresh())
      .subscribe();
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runState.running, workspaceId]);

  const { rows, total, page, totalPages } = history;
  const from = total === 0 ? 0 : (page - 1) * 25 + 1;
  const to = Math.min(total, page * 25);
  const filtered = q.trim().length > 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-headline-medium text-text-primary">Enriched contacts</h2>
          {total > 0 ? <Badge>{fmt(total)}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Search enriched contacts"
            placeholder="Search name, company or email"
            leadingIcon={RiSearchLine}
            size="small"
            value={search}
            onChange={setSearch}
            className="w-64"
            {...{ [SEARCH_SHORTCUT_ATTR]: "" }}
          />
          {total > 0 ? (
            <ButtonLink href="/api/enrich/export" variant="secondary" size="small" leadingIcon={RiDownloadLine} download>
              Download CSV
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {runState.paused ? (
        <Banner
          tone="warning"
          title="Paused, add credits to continue"
          actions={
            <ButtonLink href="/enrich?settings=billing&plan=1" variant="secondary" size="small">
              Buy credits
            </ButtonLink>
          }
        >
          A run is waiting for credits. It picks up again automatically within a minute of adding them.
        </Banner>
      ) : null}

      <div className="flex w-full min-w-0 flex-col rounded-2xl border border-border-table bg-background-primary-default">
        <Table aria-label="Enriched contacts" selectionMode="none" className="min-w-[960px]" containerClassName="rounded-t-2xl">
          <TableHeader>
            {COLUMNS.map((col) => (
              <TableColumn
                key={col.id}
                id={col.id}
                isRowHeader={col.id === "name"}
                className={cx(col.className, col.id === "name" && "sticky start-0 z-10 border-e border-separator-border")}
              >
                {col.label}
              </TableColumn>
            ))}
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <EmptyState
                size="inline"
                icon={RiUserSearchLine}
                title={filtered ? "No contacts match" : "No contacts enriched yet"}
                description={filtered ? "Try another name, company or email." : "Add a contact above to try it. Results show up here within a minute."}
              />
            )}
          >
            {rows.map((c) => {
              const pending = isPending(c);
              const name = displayName(c);
              return (
                <TableRow key={c.id} id={c.id} className="group/row">
                  <TableCell className="sticky start-0 z-10 min-w-[220px] max-w-[320px] border-e border-separator-border bg-background-primary-default">
                    <span className="flex items-center gap-2">
                      <Avatar size="sm" initials={initialsOf(name || "?")} />
                      <span className="truncate text-body-medium text-text-primary">{name}</span>
                      {c.linkedin_url ? (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${name} on LinkedIn`}
                          className="inline-flex shrink-0 text-foreground-icon-tertiary hover:text-foreground-icon-primary"
                        >
                          <RiLinkedinBoxLine className="size-4" aria-hidden />
                        </a>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-[180px] max-w-[320px]">
                    {c.job_title ? <span className="block truncate text-text-secondary">{c.job_title}</span> : pending ? <Skeleton className="h-4 w-28" /> : <span className="text-text-tertiary">—</span>}
                  </TableCell>
                  <TableCell className="min-w-[180px] max-w-[320px]">
                    {c.company || c.company_name || c.domain ? (
                      <span className="flex items-center gap-2">
                        <span className="truncate text-text-secondary">{c.company ?? c.company_name ?? c.domain}</span>
                        {c.company_domain || c.domain ? (
                          <a
                            href={`https://${c.company_domain ?? c.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Open ${c.company_domain ?? c.domain}`}
                            className="inline-flex shrink-0 text-foreground-icon-tertiary hover:text-foreground-icon-primary"
                          >
                            <RiExternalLinkLine className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </span>
                    ) : pending ? (
                      <Skeleton className="h-4 w-24" />
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[240px] max-w-[320px]">
                    <EmailCell email={c.work_email} status={c.work_email_status} isPending={pending} />
                  </TableCell>
                  <TableCell className="min-w-[220px] max-w-[320px]">
                    <EmailCell email={c.personal_email} status={c.personal_email_status} isPending={pending} />
                  </TableCell>
                  <TableCell className="min-w-[180px] max-w-[320px]">
                    <PhoneCell phone={c.phone} meta={c.phone_meta} isPending={pending} />
                  </TableCell>
                  <TableCell className="min-w-[140px]">
                    <StatusCell c={c} running={!runState.paused || runState.running} />
                  </TableCell>
                  <TableCell className="min-w-[90px] text-text-tertiary tabular-nums">{fmtDate(c.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border px-3 py-3">
          <p className="text-body-2-regular text-text-tertiary tabular-nums">{total === 0 ? "No contacts" : `${fmt(from)}–${fmt(to)} of ${fmt(total)} contacts`}</p>
          {totalPages > 1 ? <Pagination page={page} totalPages={totalPages} onChange={(p) => setParams({ page: p > 1 ? String(p) : null })} /> : null}
        </div>
      </div>
    </section>
  );
}
