import { Chip } from "@/components/base/badges/chip";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { LIST_STATUS_META, listStatusLabel } from "@/components/application/list-card/list-status";
import type { AccountDetail, AdminList } from "@/lib/admin/accounts";
import { DETAIL_PAGE_SIZE, totalPages, type AccountDetailParams } from "@/lib/admin/accounts-params";
import { n, percent, rowRange, when } from "@/lib/admin/format";
import { Block, Muted, Nothing, PartError } from "./parts";
import { UrlPagination, UrlSegmented } from "./url-controls";

const SOURCE_OPTIONS = [
  { id: "all", label: "All sources" },
  { id: "csv", label: "CSV upload" },
  { id: "manual", label: "Enrich tab" },
  { id: "mcp", label: "AI assistant" },
];

const STATUS_OPTIONS = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "finished", label: "Finished" },
  { id: "attention", label: "Paused or failed" },
  { id: "draft", label: "Drafts" },
];

function sourceLabel(list: Pick<AdminList, "source" | "sourceDetail">): string {
  if (list.source === "manual") return "Enrich tab";
  if (list.source === "mcp") return list.sourceDetail ?? "AI assistant";
  return "CSV upload";
}

/** Found count with its share of the processed contacts. */
function Found({ count, processed }: { count: number; processed: number }) {
  if (count === 0) return <Muted>0</Muted>;
  const share = percent(count, processed);
  return (
    <span className="whitespace-nowrap">
      {n(count)}
      {share !== null ? <span className="text-text-tertiary"> · {share}%</span> : null}
    </span>
  );
}

/**
 * Every list of the workspace, list level only: what ran, how far it got, how
 * much it found and what it cost. The contacts themselves are never loaded.
 */
export function ListsTab({ detail, params }: { detail: AccountDetail; params: AccountDetailParams }) {
  const { lists } = detail;
  const filtered = params.source !== "all" || params.status !== "all";
  const pages = lists.data ? totalPages(lists.data.total, DETAIL_PAGE_SIZE) : 1;

  return (
    <Block
      title="Enrichment lists"
      description="All lists of this workspace, including Enrich tab lookups and runs started by an AI assistant. Counts only, the contacts themselves are not shown."
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Filter lists by status" param="status" value={params.status} defaultValue="all" options={STATUS_OPTIONS} reset={["lists"]} />
        </div>
        <div className="max-w-full overflow-x-auto">
          <UrlSegmented aria-label="Filter lists by source" param="source" value={params.source} defaultValue="all" options={SOURCE_OPTIONS} reset={["lists"]} />
        </div>
      </div>

      {lists.error !== null ? (
        <PartError title="Lists could not be loaded" error={lists.error} />
      ) : lists.data.rows.length === 0 ? (
        <Nothing text={filtered ? "No list matches these filters." : "This workspace has not created a list yet."} />
      ) : (
        <>
          <Table aria-label="Enrichment lists" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>List</TableColumn>
              <TableColumn>Source</TableColumn>
              <TableColumn>Status</TableColumn>
              <TableColumn>Started by</TableColumn>
              <TableColumn className="text-end">Processed</TableColumn>
              <TableColumn className="text-end">Work email</TableColumn>
              <TableColumn className="text-end">Personal email</TableColumn>
              <TableColumn className="text-end">Phone</TableColumn>
              <TableColumn className="text-end">Credits</TableColumn>
              <TableColumn>Created</TableColumn>
              <TableColumn>Finished</TableColumn>
            </TableHeader>
            <TableBody>
              {lists.data.rows.map((list) => {
                const meta = LIST_STATUS_META[list.status];
                return (
                  <TableRow key={list.id}>
                    <TableCell>
                      <div className="flex max-w-[280px] flex-col gap-0.5">
                        <span className="truncate" title={list.name ?? undefined}>
                          {list.name ?? "Single lookup"}
                        </span>
                        {list.error ? (
                          <span className="truncate text-caption-1-regular text-text-error-primary" title={list.error}>
                            {list.error}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{sourceLabel(list)}</TableCell>
                    <TableCell>
                      <Chip variant="caption" color={meta.chip}>
                        {listStatusLabel({ status: list.status, pause_reason: list.pauseReason })}
                      </Chip>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{list.createdByName ?? <Muted>Deleted account</Muted>}</TableCell>
                    <TableCell className="text-end whitespace-nowrap tabular-nums">
                      {n(list.processedRows)} <span className="text-text-tertiary">of {n(list.totalRows)}</span>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Found count={list.foundWorkEmail} processed={list.processedRows} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Found count={list.foundPersonalEmail} processed={list.processedRows} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Found count={list.foundPhone} processed={list.processedRows} />
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{list.creditsUsed === 0 ? <Muted>0</Muted> : n(list.creditsUsed)}</TableCell>
                    <TableCell className="whitespace-nowrap">{when(list.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{list.completedAt ? when(list.completedAt) : <Muted>—</Muted>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-body-2-regular text-text-secondary tabular-nums">
              {rowRange(params.listsPage, DETAIL_PAGE_SIZE, lists.data.rows.length, lists.data.total)}
            </p>
            <div className="min-w-0 sm:w-[420px]">
              <UrlPagination aria-label="Lists pages" param="lists" page={params.listsPage} totalPages={pages} />
            </div>
          </div>
        </>
      )}
    </Block>
  );
}
