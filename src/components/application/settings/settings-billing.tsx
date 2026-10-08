"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { RiArrowRightUpLine, RiBankCardLine, RiCoinLine, RiHistoryLine } from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { ProgressBar } from "@/components/base/progress-bar/progress-bar";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { useToast } from "@/components/base/toast/toast";
import { PlanPicker } from "@/components/application/billing/plan-picker";
import { fetchBillingOverview, openBillingPortal } from "@/lib/billing/actions";
import type { BillingOverview, LedgerEntry } from "@/lib/billing/queries";
import { formatUsd, formatUsdFine } from "@/lib/credits/money";
import { cx } from "@/utils/cx";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

const fmt = (n: number) => n.toLocaleString("en-US");
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const STATUS_CHIP: Record<string, { label: string; color: "lime" | "yellow" | "rose" | "neutral" }> = {
  active: { label: "Active", color: "lime" },
  trialing: { label: "Trial", color: "lime" },
  past_due: { label: "Past due", color: "yellow" },
  unpaid: { label: "Unpaid", color: "rose" },
  incomplete: { label: "Incomplete", color: "yellow" },
  incomplete_expired: { label: "Expired", color: "rose" },
  paused: { label: "Paused", color: "neutral" },
  canceled: { label: "Canceled", color: "neutral" },
};

function describe(entry: LedgerEntry): string {
  switch (entry.kind) {
    case "grant":
      return entry.note ?? "Credits granted";
    case "consume":
      return entry.listName ? `Enrichment · ${entry.listName}` : "Enrichment";
    case "expire":
      return "Credits expired";
    case "adjust":
      return entry.note ?? "Adjustment";
  }
}

export type BillingView = "overview" | "plans";

export interface SettingsBillingProps {
  /** "plans" swaps the overview for the plan picker (same modal page). */
  view: BillingView;
  onViewChange: (view: BillingView) => void;
  /** Closes the settings modal (the picker's Cancel). */
  onClose: () => void;
  /** Shown above the plans, e.g. a credit shortfall. */
  planReason?: string;
  /** Bumped by the host after a Checkout return so the page reloads. */
  refreshKey?: number;
}

/**
 * Settings › Billing (plan § 6): plan card, balance with the expiry
 * schedule, Manage billing → Stripe portal, credit ledger. Data is loaded
 * on open through a server action so the modal can live in the app shell.
 */
export function SettingsBilling({ view, onViewChange, onClose, planReason, refreshKey = 0 }: SettingsBillingProps) {
  const [data, setData] = useState<BillingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalPending, startPortal] = useTransition();
  const toast = useToast();

  const load = useCallback(() => {
    fetchBillingOverview()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Could not load billing details."));
  }, []);

  useEffect(() => {
    if (view === "plans") return;
    load();
  }, [load, refreshKey, view]);

  const openPortal = () =>
    startPortal(async () => {
      const res = await openBillingPortal();
      if (res && !res.ok) toast.error(res.error);
    });

  if (view === "plans") return <PlanPicker reason={planReason} onCancel={onClose} />;

  if (error) {
    return (
      <EmptyState size="inline" icon={RiBankCardLine} title="Billing unavailable" description={error} actions={<Button variant="secondary" onClick={load}>Retry</Button>} />
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[132px] w-full rounded-2xl" />
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[200px] w-full rounded-2xl" />
      </div>
    );
  }

  const planCredits = data.plan?.credits ?? data.grants.find((g) => g.source === "trial")?.amount ?? 50;
  const low = data.available < planCredits * 0.1;
  const status = data.subscription?.status ? STATUS_CHIP[data.subscription.status] : null;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Current plan */}
      <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-body-2-medium text-text-secondary">
              Current plan
              {status ? (
                <Chip variant="caption" color={status.color}>
                  {status.label}
                </Chip>
              ) : null}
            </span>
            {data.plan ? (
              <div className="flex flex-col gap-0.5">
                <p className="text-headline-medium text-text-primary">
                  {data.plan.name}
                  {data.plan.priceCents != null ? (
                    <span className="text-text-secondary">
                      {" "}
                      · {formatUsd(data.plan.priceCents)}/{data.plan.interval === "year" ? "year" : "month"}
                    </span>
                  ) : null}
                </p>
                <p className="text-body-2-regular text-text-secondary">
                  {fmt(data.plan.credits)} credits every {data.plan.interval}
                  {data.plan.priceCents != null ? ` · ${formatUsdFine(data.plan.priceCents / data.plan.credits)} per credit` : ""}
                  {data.subscription?.currentPeriodEnd
                    ? data.subscription.cancelAtPeriodEnd
                      ? ` · cancels on ${date(data.subscription.currentPeriodEnd)}`
                      : ` · renews on ${date(data.subscription.currentPeriodEnd)}`
                    : ""}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <p className="text-headline-medium text-text-primary">Free trial</p>
                <p className="text-body-2-regular text-text-secondary">50 credits to try Preb. Choose a plan to keep enriching.</p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {data.hasCustomer ? (
              <Button variant="secondary" size="small" onClick={openPortal} disabled={!data.canManage || portalPending} trailingIcon={RiArrowRightUpLine}>
                {portalPending ? "Opening…" : "Manage billing"}
              </Button>
            ) : null}
            <Button size="small" onClick={() => onViewChange("plans")} disabled={!data.canManage}>
              {data.plan ? "Change plan" : "Choose a plan"}
            </Button>
          </div>
        </div>
        {!data.canManage ? <p className="text-body-2-regular text-text-tertiary">Only workspace owners and admins can change the plan or payment details.</p> : null}
      </div>

      {/* Balance */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Credit balance</SettingsSectionLabel>
        <SettingsCard>
          <div className="flex flex-col gap-3 py-3 pe-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-body-regular text-text-primary">
                <RiCoinLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                Available
              </span>
              <span className={cx("text-body-medium tabular-nums", low ? "text-text-error-primary" : "text-text-primary")}>
                {fmt(data.available)} / {fmt(Math.max(planCredits, data.available))}
              </span>
            </div>
            <ProgressBar aria-label="Credits remaining" value={data.available} maxValue={Math.max(1, planCredits, data.available)} tone={low ? "error" : "accent"} size="sm" />
          </div>
          {data.grants.length > 0 ? (
            data.grants.map((g) => (
              <SettingsRow key={g.id} label={`${fmt(g.remaining)} credits expire on ${date(g.expiresAt)}`} description={g.note ?? (g.source === "trial" ? "Welcome trial" : g.source === "subscription" ? "Subscription" : "Manual grant")}>
                <span className="text-body-2-regular text-text-tertiary tabular-nums">{fmt(g.remaining)} of {fmt(g.amount)} left</span>
              </SettingsRow>
            ))
          ) : (
            <SettingsRow label="No credits" description="Choose a plan to get started." />
          )}
        </SettingsCard>
      </div>

      {/* Ledger */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Credit history</SettingsSectionLabel>
        {data.ledger.length === 0 ? (
          <div className="rounded-2xl bg-background-secondary-default">
            <EmptyState size="inline" icon={RiHistoryLine} title="No activity yet" description="Grants and enrichment charges appear here." />
          </div>
        ) : (
          <Table aria-label="Credit history" size="sm" containerClassName="rounded-2xl">
            <TableHeader>
              <TableColumn isRowHeader>Date</TableColumn>
              <TableColumn>Description</TableColumn>
              <TableColumn className="text-end">Credits</TableColumn>
            </TableHeader>
            <TableBody>
              {data.ledger.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-text-secondary">{date(entry.createdAt)}</TableCell>
                  <TableCell>
                    {entry.listId && entry.kind === "consume" ? (
                      <Link href={`/lists/${entry.listId}`} className="text-text-primary underline-offset-2 hover:underline">
                        {describe(entry)}
                      </Link>
                    ) : (
                      describe(entry)
                    )}
                  </TableCell>
                  <TableCell className={cx("text-end tabular-nums", entry.delta > 0 ? "text-status-lime-text" : entry.delta < 0 ? "text-text-primary" : "text-text-tertiary")}>
                    {entry.delta > 0 ? `+${fmt(entry.delta)}` : fmt(entry.delta)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
