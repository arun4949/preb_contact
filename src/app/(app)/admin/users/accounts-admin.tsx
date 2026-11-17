"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiExpandUpDownLine,
  RiSearchLine,
  RiUserSearchLine,
} from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Banner } from "@/components/base/banner/banner";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { Input } from "@/components/base/input/input";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { RowLinks } from "@/components/application/admin-account/row-links";
import {
  UrlPagination,
  UrlSegmented,
  useUrlState,
} from "@/components/application/admin-account/url-controls";
import {
  ACCOUNTS_PAGE_SIZE,
  type AccountsParams,
  type AccountSort,
} from "@/lib/admin/accounts-params";
import { n, rowRange } from "@/lib/admin/format";
import { cx } from "@/utils/cx";

type ChipColor = "lime" | "blue" | "neutral" | "purple";

/** Plain, already formatted values (dates are formatted on the server). */
export interface AccountDisplayRow {
  id: string;
  name: string | null;
  email: string;
  workspace: string | null;
  internal: boolean;
  stage: { label: string; color: ChipColor };
  plan: { label: string; color: ChipColor };
  creditsSpent: number;
  creditsAvailable: number;
  lists: number;
  lastSignIn: string | null;
  created: string;
}

export interface AccountsAdminProps {
  params: AccountsParams;
  rows: AccountDisplayRow[];
  total: number;
  totalPages: number;
  error: string | null;
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "onboarded", label: "Onboarded" },
  { id: "paying", label: "Paying" },
  { id: "trial", label: "Trial" },
  { id: "spend", label: "With spend" },
];

function SortLabel({
  label,
  direction,
  end,
}: {
  label: string;
  direction: "ascending" | "descending" | undefined;
  end?: boolean;
}) {
  const Icon =
    direction === "ascending"
      ? RiArrowUpLine
      : direction === "descending"
        ? RiArrowDownLine
        : RiExpandUpDownLine;
  return (
    <span
      className={cx(
        "inline-flex w-full cursor-pointer items-center gap-1",
        end && "justify-end",
        direction && "text-text-primary",
      )}
    >
      {label}
      <Icon
        className={cx(
          "size-3.5 shrink-0",
          direction
            ? "text-foreground-icon-primary"
            : "text-foreground-icon-quaternary",
        )}
        aria-hidden
      />
    </span>
  );
}

/** /admin/users: search, filter, sortable table, pager. All state lives in the URL. */
export function AccountsAdmin({
  params,
  rows,
  total,
  totalPages,
  error,
}: AccountsAdminProps) {
  const { set, pending } = useUrlState();
  const [search, setSearch] = useState(params.q);

  useEffect(() => {
    if (search.trim() === params.q) return; // nothing to sync (also skips the mount run)
    const t = setTimeout(
      () => set({ q: search.trim() || null, page: null }, "replace"),
      300,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, params.q]);

  const sortBy = (column: AccountSort) => {
    const dir =
      column === params.sort
        ? params.dir === "desc"
          ? "asc"
          : "desc"
        : "desc";
    set({
      sort: column === "created" ? null : column,
      dir: dir === "desc" ? null : dir,
      page: null,
    });
  };
  const direction = (column: AccountSort) =>
    params.sort === column
      ? params.dir === "asc"
        ? "ascending"
        : "descending"
      : undefined;
  const filtered = params.q.length > 0 || params.filter !== "all";

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Accounts</h1>
        <p className="text-body-regular text-text-secondary">
          Every account with its workspace, plan and credit use. Credits are
          counted per workspace, so people who share one show the same figures.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented
            aria-label="Filter accounts"
            param="filter"
            value={params.filter}
            defaultValue="all"
            options={FILTERS}
            reset={["page"]}
          />
        </div>
        <div className="ms-auto w-full sm:w-[320px]">
          <Input
            aria-label="Search accounts"
            placeholder="Search name, email or workspace…"
            leadingIcon={RiSearchLine}
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {error ? (
        <Banner tone="error" title="Accounts could not be loaded">
          {error}
        </Banner>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
          <EmptyState
            icon={RiUserSearchLine}
            title={filtered ? "No account matches" : "No accounts yet"}
            description={
              filtered
                ? "Try another search term or filter."
                : "Accounts appear here as soon as someone requests a sign-in code."
            }
          />
        </div>
      ) : (
        <div
          className={cx(
            "flex flex-col gap-4 transition-opacity",
            pending && "opacity-70",
          )}
        >
          <RowLinks base="/admin/users">
            <Table
              aria-label="Accounts"
              size="sm"
              containerClassName="rounded-2xl"
              sortDescriptor={{
                column: params.sort,
                direction: params.dir === "asc" ? "ascending" : "descending",
              }}
              onSortChange={(descriptor) =>
                sortBy(descriptor.column as AccountSort)
              }
            >
              <TableHeader>
                <TableColumn id="name" isRowHeader>
                  Name
                </TableColumn>
                <TableColumn id="email">Email</TableColumn>
                <TableColumn id="workspace">Workspace</TableColumn>
                <TableColumn id="status">Status</TableColumn>
                <TableColumn id="plan">Plan</TableColumn>
                <TableColumn id="spent" allowsSorting>
                  <SortLabel
                    label="Credits spent"
                    direction={direction("spent")}
                    end
                  />
                </TableColumn>
                <TableColumn id="available" allowsSorting>
                  <SortLabel
                    label="Credits left"
                    direction={direction("available")}
                    end
                  />
                </TableColumn>
                <TableColumn id="lists" allowsSorting>
                  <SortLabel label="Lists" direction={direction("lists")} end />
                </TableColumn>
                <TableColumn id="last_sign_in" allowsSorting>
                  <SortLabel
                    label="Last sign-in"
                    direction={direction("last_sign_in")}
                  />
                </TableColumn>
                <TableColumn id="created" allowsSorting>
                  <SortLabel label="Created" direction={direction("created")} />
                </TableColumn>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow
                    key={a.id}
                    id={a.id}
                    className="cursor-pointer hover:bg-background-secondary-default"
                  >
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/admin/users/${a.id}`}
                        className="rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                      >
                        {a.name ?? (
                          <span className="text-text-tertiary">
                            Not onboarded
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell dir="ltr">{a.email}</TableCell>
                    <TableCell>
                      <span className="flex max-w-[240px] items-center gap-2">
                        <span className="truncate">{a.workspace ?? "—"}</span>
                        {a.internal ? (
                          <Chip variant="caption" color="purple">
                            Internal
                          </Chip>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip variant="caption" color={a.stage.color}>
                        {a.stage.label}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <Chip variant="caption" color={a.plan.color}>
                        {a.plan.label}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {a.creditsSpent === 0 ? (
                        <span className="text-text-tertiary">0</span>
                      ) : (
                        n(a.creditsSpent)
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {n(a.creditsAvailable)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {a.lists === 0 ? (
                        <span className="text-text-tertiary">0</span>
                      ) : (
                        n(a.lists)
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {a.lastSignIn ?? (
                        <span className="text-text-tertiary">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {a.created}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </RowLinks>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-2-regular text-text-secondary tabular-nums">
              {rowRange(params.page, ACCOUNTS_PAGE_SIZE, rows.length, total)}
            </p>
            <div className="min-w-0 sm:w-[420px]">
              <UrlPagination
                aria-label="Accounts pages"
                param="page"
                page={params.page}
                totalPages={totalPages}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
