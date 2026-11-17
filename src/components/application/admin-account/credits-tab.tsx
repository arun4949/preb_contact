import { Chip } from "@/components/base/badges/chip";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import type { AccountDetail } from "@/lib/admin/accounts";
import { DETAIL_PAGE_SIZE, totalPages, type AccountDetailParams } from "@/lib/admin/accounts-params";
import { day, n, rowRange, when } from "@/lib/admin/format";
import { ledgerLabel } from "@/lib/billing/ledger-label";
import { cx } from "@/utils/cx";
import { Block, Card, Field, Fields, Muted, Nothing, PartError, humanize } from "./parts";
import { UrlPagination } from "./url-controls";

const GRANT_SOURCE: Record<string, string> = { trial: "Trial", subscription: "Subscription", manual: "Manual", referral: "Referral reward" };

/** Where the spend came from, the credit grants and the full ledger. */
export function CreditsTab({ detail, params }: { detail: AccountDetail; params: AccountDetailParams }) {
  const { spend, grants, ledger, workspace } = detail;
  const internal = workspace?.kind === "internal";
  const pages = ledger.data ? totalPages(ledger.data.total, DETAIL_PAGE_SIZE) : 1;

  return (
    <>
      <Card
        title="Credits spent"
        description={
          internal
            ? "Internal workspace: use is measured in the ledger but never charged."
            : "Read from the credit ledger, so lists that were deleted since are still counted."
        }
      >
        {spend.error !== null ? (
          <PartError title="Spend could not be loaded" error={spend.error} />
        ) : (
          <Fields>
            <Field label="Total">
              <span className="tabular-nums">{n(spend.data.spent)}</span>
            </Field>
            <Field label="Last 30 days">
              <span className="tabular-nums">{n(spend.data.spent30d)}</span>
            </Field>
            <Field label={internal ? "Measured, not charged" : "Paid from the balance"}>
              <span className="tabular-nums">{n(spend.data.fromBalance)}</span>
            </Field>
            <Field label="Overspend, invoiced in money">
              <span className="tabular-nums">{n(spend.data.overspend)}</span>
            </Field>
            <Field label="Overdraft absorbed by Preb">
              <span className="tabular-nums">{n(spend.data.absorbed)}</span>
            </Field>
            <Field label="Last spend">{spend.data.lastSpendAt ? when(spend.data.lastSpendAt) : <Muted>Never</Muted>}</Field>
          </Fields>
        )}
      </Card>

      <Block title="Credit grants" description="Every grant of this workspace, newest first. Credits are used from the grant that expires first.">
        {grants.error !== null ? (
          <PartError title="Grants could not be loaded" error={grants.error} />
        ) : grants.data.length === 0 ? (
          <Nothing text="No credits were ever granted to this workspace." />
        ) : (
          <Table aria-label="Credit grants" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Grant</TableColumn>
              <TableColumn>Source</TableColumn>
              <TableColumn>Granted</TableColumn>
              <TableColumn className="text-end">Amount</TableColumn>
              <TableColumn className="text-end">Remaining</TableColumn>
              <TableColumn>Expires</TableColumn>
              <TableColumn>State</TableColumn>
            </TableHeader>
            <TableBody>
              {grants.data.map((grant) => {
                const state = grant.expired ? { label: "Expired", color: "neutral" as const } : grant.remaining === 0 ? { label: "Used up", color: "neutral" as const } : { label: "Active", color: "lime" as const };
                return (
                  <TableRow key={grant.id}>
                    <TableCell className="max-w-[260px] truncate">{grant.note ?? <Muted>No note</Muted>}</TableCell>
                    <TableCell className="whitespace-nowrap">{GRANT_SOURCE[grant.source] ?? humanize(grant.source)}</TableCell>
                    <TableCell className="whitespace-nowrap">{day(grant.grantedAt)}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(grant.amount)}</TableCell>
                    <TableCell className="text-end tabular-nums">{n(grant.remaining)}</TableCell>
                    <TableCell className="whitespace-nowrap">{day(grant.expiresAt)}</TableCell>
                    <TableCell>
                      <Chip variant="caption" color={state.color}>
                        {state.label}
                      </Chip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Block>

      <Block title="Credit history" description="The ledger of this workspace, with the same labels the customer sees under Billing.">
        {ledger.error !== null ? (
          <PartError title="Credit history could not be loaded" error={ledger.error} />
        ) : ledger.data.rows.length === 0 ? (
          <Nothing text="No credit activity yet." />
        ) : (
          <>
            <Table aria-label="Credit history" size="sm" containerClassName="rounded-2xl">
              <TableHeader>
                <TableColumn isRowHeader>Entry</TableColumn>
                <TableColumn>Type</TableColumn>
                <TableColumn>When</TableColumn>
                <TableColumn className="text-end">Credits</TableColumn>
              </TableHeader>
              <TableBody>
                {ledger.data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[420px] truncate">{ledgerLabel(row)}</TableCell>
                    <TableCell className="whitespace-nowrap">{humanize(row.kind)}</TableCell>
                    <TableCell className="whitespace-nowrap">{when(row.createdAt)}</TableCell>
                    <TableCell className={cx("text-end tabular-nums", row.delta > 0 ? "text-status-lime-text" : "text-text-primary")}>
                      {row.delta > 0 ? `+${n(row.delta)}` : n(row.delta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body-2-regular text-text-secondary tabular-nums">
                {rowRange(params.ledgerPage, DETAIL_PAGE_SIZE, ledger.data.rows.length, ledger.data.total)}
              </p>
              <div className="min-w-0 sm:w-[420px]">
                <UrlPagination aria-label="Credit history pages" param="ledger" page={params.ledgerPage} totalPages={pages} />
              </div>
            </div>
          </>
        )}
      </Block>
    </>
  );
}
