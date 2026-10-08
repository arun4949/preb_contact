"use client";

import { useMemo, useState } from "react";
import { RiExternalLinkLine, RiFileCopyLine, RiGroupLine, RiLinkedinBoxLine } from "@remixicon/react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Avatar } from "@/components/base/avatar/avatar";
import { Chip } from "@/components/base/badges/chip";
import { StatusDot } from "@/components/base/badges/status-dot";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Pagination } from "@/components/base/pagination/pagination";
import { Select, SelectItem } from "@/components/base/select/select";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { useToast } from "@/components/base/toast/toast";
import { ChevronSortDown } from "@/components/foundations/icons/chevrons";
import { uiEmailStatus } from "@/lib/fullenrich/mapping";
import type { EmailStatus, EnrichedPhone } from "@/lib/fullenrich/types";
import { PAGE_SIZES, type ContactQuery, type ContactSort } from "@/lib/lists/contact-query";
import { contactUiStatus, type ContactRow } from "@/lib/lists/segments";
import { cx } from "@/utils/cx";
import { initialsOf } from "@/utils/initials";
import { extraColumnId } from "./columns";
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

const WIDTHS: Record<string, string> = {
  name: "min-w-[220px]",
  job_title: "min-w-[180px]",
  company: "min-w-[200px]",
  location: "min-w-[160px]",
  work_email: "min-w-[240px]",
  personal_email: "min-w-[220px]",
  phone: "min-w-[180px]",
  status: "min-w-[140px]",
};

function displayName(c: ContactRow): string {
  // Email-only rows have no name until the reverse lookup identifies them: show the email.
  return c.full_name ?? ([c.first_name, c.last_name].filter(Boolean).join(" ") || c.email_input || "");
}

function CopyButton({ value, label }: { value: string; label: string }) {
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

function EmailCell({ email, status, isPending }: { email: string | null; status: string | null; isPending: boolean }) {
  if (!email) return isPending ? <Skeleton className="h-4 w-36" /> : <span className="text-text-tertiary">—</span>;
  const ui = uiEmailStatus(status as EmailStatus | null);
  return (
    <span className="flex items-center gap-2">
      <StatusDot color={ui === "valid" ? "green" : ui === "risky" ? "yellow" : "indigo"} aria-label={ui === "valid" ? "Valid" : ui === "risky" ? "Risky (catch-all)" : "Unknown"} />
      <span className="truncate" dir="ltr">
        {email}
      </span>
      <CopyButton value={email} label="email" />
    </span>
  );
}

function PhoneCell({ phone, meta, isPending }: { phone: string | null; meta: ContactRow["phone_meta"]; isPending: boolean }) {
  if (!phone) return isPending ? <Skeleton className="h-4 w-28" /> : <span className="text-text-tertiary">—</span>;
  const type = (meta as EnrichedPhone | null)?.line_type;
  return (
    <span className="flex items-center gap-2">
      <span className="truncate tabular-nums" dir="ltr">
        {phone}
      </span>
      {type === "MOBILE" ? (
        <Chip variant="caption" color="cyan">Mobile</Chip>
      ) : type === "LANDLINE" ? (
        <Chip variant="caption" color="neutral">Landline</Chip>
      ) : null}
      <CopyButton value={phone} label="phone" />
    </span>
  );
}

function StatusCell({ c }: { c: ContactRow }) {
  const s = contactUiStatus(c);
  switch (s.kind) {
    case "pending":
      return <Chip variant="caption" color="blue">Pending</Chip>;
    case "enriched":
      return <Chip variant="caption" color="lime">Enriched</Chip>;
    case "cached":
      return <Chip variant="caption" color="purple">Already enriched</Chip>;
    case "not_found":
      return <Chip variant="caption" color="neutral">Not found</Chip>;
    case "skipped":
      return (
        <Chip variant="caption" color="neutral" title={s.reason}>
          Skipped · {s.reason}
        </Chip>
      );
  }
}

/** Server-paginated contacts table (fork of BoardUI's Data Table recipe; TanStack for column plumbing only). */
export function ContactsTable({ rows, total, totalPages, query, onChange, visibility, extras, running, pending, filtered }: ContactsTableProps) {
  const [failedLogos, setFailedLogos] = useState<Set<string>>(() => new Set());

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
              <span className="truncate text-body-medium text-text-primary">{name}</span>
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
      { id: "job_title", header: "Job title", cell: ({ row }) => <span className="block truncate text-text-secondary">{row.original.job_title ?? <span className="text-text-tertiary">—</span>}</span> },
      {
        id: "company",
        header: "Company",
        cell: ({ row }) => {
          const c = row.original;
          const name = c.company ?? c.company_name;
          const domain = c.company_domain ?? c.domain;
          const logo = c.company_logo_url && !failedLogos.has(c.id) ? c.company_logo_url : null;
          if (!name && !domain) return <span className="text-text-tertiary">—</span>;
          return (
            <span className="flex min-w-0 items-center gap-2">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" width={20} height={20} className="size-5 shrink-0 rounded-sm object-contain" referrerPolicy="no-referrer" onError={() => setFailedLogos((s) => new Set(s).add(c.id))} />
              ) : (
                <Avatar size="xs" color="neutral" initials={initialsOf(name ?? domain ?? "?").slice(0, 1)} className="rounded-sm" />
              )}
              <span className="truncate text-text-primary">{name ?? domain}</span>
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
      { id: "location", header: "Location", cell: ({ row }) => <span className="block truncate text-text-secondary">{row.original.location ?? <span className="text-text-tertiary">—</span>}</span> },
      {
        id: "work_email",
        header: "Work email",
        cell: ({ row }) => <EmailCell email={row.original.work_email} status={row.original.work_email_status} isPending={running && contactUiStatus(row.original).kind === "pending"} />,
      },
      {
        id: "personal_email",
        header: "Personal email",
        cell: ({ row }) => <EmailCell email={row.original.personal_email} status={row.original.personal_email_status} isPending={running && contactUiStatus(row.original).kind === "pending"} />,
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => <PhoneCell phone={row.original.phone} meta={row.original.phone_meta} isPending={running && contactUiStatus(row.original).kind === "pending"} />,
      },
      { id: "status", header: "Status", cell: ({ row }) => <StatusCell c={row.original} /> },
    ];
    const extraDefs: ColumnDef<ContactRow>[] = extras.map((h) => ({
      id: extraColumnId(h),
      header: h,
      cell: ({ row }) => {
        const raw = (row.original.raw ?? {}) as Record<string, unknown>;
        const v = raw[h];
        return v == null || v === "" ? <span className="text-text-tertiary">—</span> : <span className="block max-w-[260px] truncate text-text-secondary">{String(v)}</span>;
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
    if (query.sort === sort) onChange(query.dir === "asc" ? { dir: "desc" } : { sort: "row", dir: "asc" });
    else onChange({ sort, dir: "asc" });
  };

  return (
    <section className={cx("flex w-full min-w-0 flex-col rounded-2xl border border-border-table bg-background-primary-default transition-opacity", pending && "opacity-70")}>
      <Table aria-label="Contacts" selectionMode="none" className="min-w-[960px]" containerClassName="rounded-t-2xl">
        <TableHeader>
          {headers.map((header) => {
            const id = header.column.id;
            const sortable = Boolean(SORTABLE[id]);
            const active = SORTABLE[id] === query.sort;
            const label = flexRender(header.column.columnDef.header, header.getContext());
            return (
              <TableColumn
                key={header.id}
                id={header.id}
                isRowHeader={id === "name"}
                className={cx(WIDTHS[id] ?? "min-w-[160px]", id === "name" && "sticky start-0 z-10 border-e border-separator-border")}
              >
                {sortable ? (
                  <button type="button" onClick={() => toggleSort(id)} className="flex cursor-pointer items-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring rounded-sm">
                    {label}
                    <ChevronSortDown className={cx("size-5 shrink-0 transition-[transform,color] duration-150", active && query.dir === "asc" && "rotate-180", active ? "text-text-secondary" : "text-text-tertiary")} />
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
              title={filtered ? "No contacts match" : running ? "Waiting for the first results" : "No contacts"}
              description={filtered ? "Try another filter or search term." : running ? "Rows fill in here as the enrichment network returns them." : undefined}
            />
          )}
        >
          {visibleRows.map((row) => (
            <TableRow key={row.id} id={row.id} className="group/row">
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={cx(WIDTHS[cell.column.id] ?? "min-w-[160px]", "max-w-[320px]", cell.column.id === "name" && "sticky start-0 z-10 border-e border-separator-border bg-background-primary-default")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-separator-border px-3 py-3">
        <p className="text-body-2-regular text-text-tertiary tabular-nums">
          {total === 0 ? "No contacts" : `${fmt(from)}–${fmt(to)} of ${fmt(total)} contacts`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Select aria-label="Rows per page" size="sm" selectedKey={String(query.pageSize)} onSelectionChange={(k) => onChange({ size: Number(k) })} className="w-[132px]">
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} id={String(n)} textValue={`${n} per page`}>
                {n} per page
              </SelectItem>
            ))}
          </Select>
          {totalPages > 1 ? <Pagination page={query.page} totalPages={totalPages} onChange={(p) => onChange({ page: p })} /> : null}
        </div>
      </div>
    </section>
  );
}
