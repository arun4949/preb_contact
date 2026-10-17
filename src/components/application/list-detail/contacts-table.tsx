"use client";

import { useMemo, useRef, useState } from "react";
import {
  RiExternalLinkLine,
  RiFileCopyLine,
  RiGroupLine,
  RiLinkedinBoxLine,
} from "@remixicon/react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Avatar } from "@/components/base/avatar/avatar";
import { DotsIndicator } from "@/components/application/agent-thinking/agent-thinking";
import { Chip } from "@/components/base/badges/chip";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Pagination } from "@/components/base/pagination/pagination";
import { Select, SelectItem } from "@/components/base/select/select";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import {
  HorizontalScrollEdges,
  useHorizontalScroll,
} from "@/components/base/table/horizontal-scroll-edges";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { useToast } from "@/components/base/toast/toast";
import { ChevronSortDown } from "@/components/foundations/icons/chevrons";
import type { EnrichedPhone } from "@/lib/fullenrich/types";
import { emailCandidates, phoneCandidates } from "@/lib/lists/candidates";
import { emailLevel } from "@/lib/lists/email-levels";
import {
  PAGE_SIZES,
  type ContactQuery,
  type ContactSort,
} from "@/lib/lists/contact-query";
import { contactUiStatus, type ContactRow } from "@/lib/lists/segments";
import { cx } from "@/utils/cx";
import { initialsOf } from "@/utils/initials";
import { extraColumnId } from "./columns";
import {
  CandidateBadge,
  EmailCandidateList,
  EmailMarker,
  PhoneCandidateList,
  PhoneConnectMarker,
  PhoneInfoMarker,
  PhoneOwnershipMarker,
} from "./status-markers";
import type { QueryPatch } from "./use-contact-query";

const fmt = (n: number) => n.toLocaleString("en-US");

export interface ContactsTableProps {
  rows: ContactRow[];
  total: number;
  totalPages: number;
  query: ContactQuery;
  onChange: (patch: QueryPatch) => void;
  visibility: Record<string, boolean>;
  extras: string[];
  /** List still running: pending rows show skeleton cells. */
  running: boolean;
  /** A new page is on its way (filter, sort, search, paging): the body shows skeleton rows. */
  pending: boolean;
  filtered: boolean;
}

const SORTABLE: Partial<Record<string, ContactSort>> = {
  name: "name",
  job_title: "job_title",
  company: "company",
  location: "location",
  work_email: "work_email",
  phone: "phone",
};

/** Per-column width bounds: results get room for their markers, profile text truncates earlier. */
const WIDTHS: Record<string, string> = {
  name: "min-w-[200px] max-w-[260px]",
  company: "min-w-[160px] max-w-[220px]",
  work_email: "min-w-[250px] max-w-[320px]",
  phone: "min-w-[210px] max-w-[280px]",
  personal_email: "min-w-[240px] max-w-[320px]",
  job_title: "min-w-[160px] max-w-[240px]",
  location: "min-w-[140px] max-w-[200px]",
  status: "min-w-[120px] max-w-[200px]",
};

function displayName(c: ContactRow): string {
  // Email-only rows have no name until the reverse lookup identifies them: show the email.
  return (
    c.full_name ??
    ([c.first_name, c.last_name].filter(Boolean).join(" ") ||
      c.email_input ||
      "")
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          toast.success("Copied");
        } catch {
          toast.error("Couldn't copy");
        }
      }}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-foreground-icon-tertiary opacity-0 transition-opacity hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:opacity-100 group-hover/row:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
    >
      <RiFileCopyLine className="size-4" aria-hidden />
    </button>
  );
}

export interface EmailCellProps {
  email: string | null;
  status: string | null;
  /** The stored provider record, for the other candidate addresses. */
  result?: ContactRow["result"];
  field: "work" | "personal";
  isPending: boolean;
}

/** Address, level marker with tooltip, a counter when more addresses were found, copy. */
export function EmailCell({
  email,
  status,
  result,
  field,
  isPending,
}: EmailCellProps) {
  if (!email)
    return isPending ? (
      <Skeleton className="h-4 w-36" />
    ) : (
      <span className="text-text-tertiary">—</span>
    );
  const level = emailLevel(status);
  const candidates = emailCandidates(result, field);
  const label = field === "work" ? "work emails" : "personal emails";
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate" dir="ltr">
        {email}
      </span>
      {level ? <EmailMarker level={level} /> : null}
      {candidates.length > 1 ? (
        <CandidateBadge
          title={`${candidates.length} ${label} found`}
          count={candidates.length}
        >
          <EmailCandidateList candidates={candidates} />
        </CandidateBadge>
      ) : null}
      <CopyButton value={email} label="email" />
    </span>
  );
}

export interface PhoneCellProps {
  phone: string | null;
  meta: ContactRow["phone_meta"];
  result?: ContactRow["result"];
  isPending: boolean;
}

/** Number, ownership and connect rate markers, a Landline chip for non-mobile lines, a counter for more numbers, copy. */
export function PhoneCell({ phone, meta, result, isPending }: PhoneCellProps) {
  if (!phone)
    return isPending ? (
      <Skeleton className="h-4 w-28" />
    ) : (
      <span className="text-text-tertiary">—</span>
    );
  const m = (meta ?? null) as EnrichedPhone | null;
  const type = m?.line_type;
  const candidates = phoneCandidates(result);
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate tabular-nums" dir="ltr">
        {phone}
      </span>
      <PhoneOwnershipMarker meta={m} />
      <PhoneConnectMarker meta={m} />
      <PhoneInfoMarker meta={m} />
      {type === "LANDLINE" ? (
        <Chip variant="caption" color="neutral">
          Landline
        </Chip>
      ) : type === "VOIP" ? (
        <Chip variant="caption" color="neutral">
          VoIP
        </Chip>
      ) : null}
      {candidates.length > 1 ? (
        <CandidateBadge
          title={`${candidates.length} phone numbers found`}
          count={candidates.length}
        >
          <PhoneCandidateList candidates={candidates} />
        </CandidateBadge>
      ) : null}
      <CopyButton value={phone} label="phone" />
    </span>
  );
}

/** Animated "Running" pill (BoardUI agent-thinking dots) for rows in flight. */
export function RunningChip() {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 py-0.5 ps-1.5 pe-2 text-caption-1-medium text-accent-700"
    >
      <DotsIndicator variant="spin" />
      Running
    </span>
  );
}

/** `running`: the run is active, so pending rows animate; otherwise they read "Waiting" (paused or queued behind credits). */
export function StatusCell({
  c,
  running = true,
}: {
  c: ContactRow;
  running?: boolean;
}) {
  const s = contactUiStatus(c);
  switch (s.kind) {
    case "pending":
      return running ? (
        <RunningChip />
      ) : (
        <Chip variant="caption" color="blue">
          Waiting
        </Chip>
      );
    case "enriched":
      return (
        <Chip variant="caption" color="lime">
          Enriched
        </Chip>
      );
    case "cached":
      return (
        <Chip variant="caption" color="purple">
          Already enriched
        </Chip>
      );
    case "not_found":
      return (
        <Chip variant="caption" color="neutral">
          Not found
        </Chip>
      );
    case "skipped":
      return (
        <Chip variant="caption" color="neutral" title={s.reason}>
          Skipped · {s.reason}
        </Chip>
      );
    case "suppressed":
      return (
        <Chip
          variant="caption"
          color="neutral"
          title="This person asked not to be contacted through Preb. No data is shown or exported."
        >
          Suppressed
        </Chip>
      );
  }
}

/** Server-paginated contacts table (fork of BoardUI's Data Table recipe; TanStack for column plumbing only). */
export function ContactsTable({
  rows,
  total,
  totalPages,
  query,
  onChange,
  visibility,
  extras,
  running,
  pending,
  filtered,
}: ContactsTableProps) {
  const [failedLogos, setFailedLogos] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const edges = useHorizontalScroll(scrollRef);

  const columns = useMemo<ColumnDef<ContactRow>[]>(() => {
    const core: ColumnDef<ContactRow>[] = [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const c = row.original;
          const name = displayName(c) || "Unknown";
          return (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar size="sm" color="neutral" initials={initialsOf(name)} />
              <span className="truncate text-body-medium text-text-primary">
                {name}
              </span>
              {c.linkedin_url ? (
                <a
                  href={c.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${name} on LinkedIn`}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-foreground-icon-tertiary hover:text-foreground-icon-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  <RiLinkedinBoxLine className="size-4" aria-hidden />
                </a>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "company",
        header: "Company",
        cell: ({ row }) => {
          const c = row.original;
          const name = c.company ?? c.company_name;
          const domain = c.company_domain ?? c.domain;
          const logo =
            c.company_logo_url && !failedLogos.has(c.id)
              ? c.company_logo_url
              : null;
          if (!name && !domain)
            return <span className="text-text-tertiary">—</span>;
          return (
            <span className="flex min-w-0 items-center gap-2">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  width={20}
                  height={20}
                  className="size-5 shrink-0 rounded-sm object-contain"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedLogos((s) => new Set(s).add(c.id))}
                />
              ) : (
                <Avatar
                  size="xs"
                  color="neutral"
                  initials={initialsOf(name ?? domain ?? "?").slice(0, 1)}
                  className="rounded-sm"
                />
              )}
              <span className="truncate text-text-primary">
                {name ?? domain}
              </span>
              {domain ? (
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${domain}`}
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-foreground-icon-tertiary hover:text-foreground-icon-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  <RiExternalLinkLine className="size-4" aria-hidden />
                </a>
              ) : null}
            </span>
          );
        },
      },
      {
        id: "work_email",
        header: "Work email",
        cell: ({ row }) => (
          <EmailCell
            email={row.original.work_email}
            status={row.original.work_email_status}
            result={row.original.result}
            field="work"
            isPending={
              running && contactUiStatus(row.original).kind === "pending"
            }
          />
        ),
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <PhoneCell
            phone={row.original.phone}
            meta={row.original.phone_meta}
            result={row.original.result}
            isPending={
              running && contactUiStatus(row.original).kind === "pending"
            }
          />
        ),
      },
      {
        id: "personal_email",
        header: "Personal email",
        cell: ({ row }) => (
          <EmailCell
            email={row.original.personal_email}
            status={row.original.personal_email_status}
            result={row.original.result}
            field="personal"
            isPending={
              running && contactUiStatus(row.original).kind === "pending"
            }
          />
        ),
      },
      {
        id: "job_title",
        header: "Job title",
        cell: ({ row }) => (
          <span className="block truncate text-text-secondary">
            {row.original.job_title ?? (
              <span className="text-text-tertiary">—</span>
            )}
          </span>
        ),
      },
      {
        id: "location",
        header: "Location",
        cell: ({ row }) => (
          <span className="block truncate text-text-secondary">
            {row.original.location ?? (
              <span className="text-text-tertiary">—</span>
            )}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusCell c={row.original} running={running} />,
      },
    ];
    const extraDefs: ColumnDef<ContactRow>[] = extras.map((h) => ({
      id: extraColumnId(h),
      header: h,
      cell: ({ row }) => {
        const raw = (row.original.raw ?? {}) as Record<string, unknown>;
        const v = raw[h];
        return v == null || v === "" ? (
          <span className="text-text-tertiary">—</span>
        ) : (
          <span className="block max-w-[260px] truncate text-text-secondary">
            {String(v)}
          </span>
        );
      },
    }));
    return [...core, ...extraDefs];
  }, [extras, running, failedLogos]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (r) => r.id,
    state: { columnVisibility: visibility },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  const headers = table.getHeaderGroups()[0].headers;
  const visibleRows = table.getRowModel().rows;
  const from = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const to = Math.min(total, query.page * query.pageSize);

  const toggleSort = (id: string) => {
    const sort = SORTABLE[id];
    if (!sort) return;
    if (query.sort === sort)
      onChange(
        query.dir === "asc" ? { dir: "desc" } : { sort: "row", dir: "asc" },
      );
    else onChange({ sort, dir: "asc" });
  };

  return (
    <section
      className="flex w-full min-w-0 flex-col rounded-2xl border border-border-table bg-background-primary-default"
      aria-busy={pending}
    >
      <div className="relative">
        <Table
          aria-label="Contacts"
          selectionMode="none"
          className="min-w-[960px]"
          containerClassName="rounded-t-2xl"
          containerRef={scrollRef}
        >
          <TableHeader>
            {headers.map((header) => {
              const id = header.column.id;
              const sortable = Boolean(SORTABLE[id]);
              const active = SORTABLE[id] === query.sort;
              const label = flexRender(
                header.column.columnDef.header,
                header.getContext(),
              );
              return (
                <TableColumn
                  key={header.id}
                  id={header.id}
                  isRowHeader={id === "name"}
                  className={cx(
                    WIDTHS[id] ?? "min-w-[160px]",
                    id === "name" &&
                      "sticky start-0 z-10 border-e border-separator-border",
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(id)}
                      className="flex cursor-pointer items-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring rounded-sm"
                    >
                      {label}
                      <ChevronSortDown
                        className={cx(
                          "size-5 shrink-0 transition-[transform,color] duration-150",
                          active && query.dir === "asc" && "rotate-180",
                          active ? "text-text-secondary" : "text-text-tertiary",
                        )}
                      />
                    </button>
                  ) : (
                    label
                  )}
                </TableColumn>
              );
            })}
          </TableHeader>
          <TableBody
            renderEmptyState={() => (
              <EmptyState
                size="inline"
                icon={RiGroupLine}
                title={
                  filtered
                    ? "No contacts match"
                    : running
                      ? "Waiting for the first results"
                      : "No contacts"
                }
                description={
                  filtered
                    ? "Try another filter or search term."
                    : running
                      ? "Rows fill in here as the enrichment network returns them."
                      : undefined
                }
              />
            )}
          >
            {pending
              ? Array.from(
                  {
                    length: Math.min(
                      query.pageSize,
                      Math.max(visibleRows.length, 6),
                    ),
                  },
                  (_, i) => (
                    <TableRow key={`skeleton-${i}`} id={`skeleton-${i}`}>
                      {headers.map((header) => (
                        <TableCell
                          key={header.id}
                          className={cx(
                            WIDTHS[header.column.id] ??
                              "min-w-[160px] max-w-[320px]",
                            header.column.id === "name" &&
                              "sticky start-0 z-10 border-e border-separator-border bg-background-primary-default",
                          )}
                        >
                          <Skeleton
                            shape="text"
                            className={
                              header.column.id === "name"
                                ? "w-36"
                                : header.column.id === "status"
                                  ? "w-16"
                                  : "w-3/4"
                            }
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ),
                )
              : visibleRows.map((row) => (
                  <TableRow key={row.id} id={row.id} className="group/row">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cx(
                          WIDTHS[cell.column.id] ??
                            "min-w-[160px] max-w-[320px]",
                          cell.column.id === "name" &&
                            "sticky start-0 z-10 border-e border-separator-border bg-background-primary-default",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
        <HorizontalScrollEdges {...edges} className="rounded-t-2xl" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border px-3 py-3">
        <p className="text-body-2-regular text-text-tertiary tabular-nums">
          {total === 0
            ? "No contacts"
            : `${fmt(from)}–${fmt(to)} of ${fmt(total)} contacts`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="Rows per page"
            size="sm"
            selectedKey={String(query.pageSize)}
            onSelectionChange={(k) => onChange({ size: Number(k) })}
            className="w-[132px]"
          >
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} id={String(n)} textValue={`${n} per page`}>
                {n} per page
              </SelectItem>
            ))}
          </Select>
          {totalPages > 1 ? (
            <Pagination
              page={query.page}
              totalPages={totalPages}
              onChange={(p) => onChange({ page: p })}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
