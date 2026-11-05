"use client";

import { useState, useTransition } from "react";
import { RiGiftLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import { EmptyState } from "@/components/base/empty-state/empty-state";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@/components/base/table/table";
import { useToast } from "@/components/base/toast/toast";
import { getPlan } from "@/lib/credits/plans";
import { fetchAllReferrals, revokeReferralReward, type AdminReferral } from "@/lib/referrals/admin-actions";
import type { ReferralRejectedReason, ReferralStatus } from "@/lib/referrals/constants";

type Filter = "all" | "pending" | "rewarded" | "rejected";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const n = (v: number) => v.toLocaleString("en-US");

const STATUS: Record<ReferralStatus, { label: string; color: "yellow" | "lime" | "neutral" | "rose" | "orange" }> = {
  pending: { label: "Pending", color: "yellow" },
  rewarded: { label: "Rewarded", color: "lime" },
  expired: { label: "Expired", color: "neutral" },
  rejected: { label: "Rejected", color: "orange" },
  revoked: { label: "Revoked", color: "rose" },
};

const REASON: Record<ReferralRejectedReason, string> = {
  self_referral: "Own address",
  same_domain: "Same company domain",
  same_workspace: "Already in the workspace",
  not_owner: "Invitee, no own workspace",
  recreated_account: "Deleted account came back",
  referrer_internal: "Internal workspace",
  code_revoked: "Code revoked",
  stale_account: "Account older than an hour",
  monthly_cap: "Monthly cap reached",
};

const SOURCE: Record<AdminReferral["source"], string> = { magic_link: "Magic link", oauth: "Google", onboarding: "Onboarding" };

/** Page shell: filter, the table, the revoke dialog. */
export function ReferralsAdmin({ referrals: initial }: { referrals: AdminReferral[] }) {
  const [referrals, setReferrals] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [revoking, setRevoking] = useState<AdminReferral | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const rows = referrals.filter((r) => (filter === "all" ? true : filter === "rejected" ? r.status === "rejected" || r.status === "revoked" : r.status === filter));
  const counts = {
    all: referrals.length,
    pending: referrals.filter((r) => r.status === "pending").length,
    rewarded: referrals.filter((r) => r.status === "rewarded").length,
    rejected: referrals.filter((r) => r.status === "rejected" || r.status === "revoked").length,
  };
  const credits = referrals.reduce((sum, r) => sum + (r.status === "rewarded" ? (r.rewardCredits ?? 0) : 0), 0);

  const revoke = () => {
    if (!revoking || pending) return;
    const target = revoking;
    start(async () => {
      const res = await revokeReferralReward(target.id);
      setRevoking(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Reward withdrawn, ${n(res.data.removed)} unused ${res.data.removed === 1 ? "credit" : "credits"} removed from ${target.referrer.workspaceName}`);
      setReferrals(await fetchAllReferrals());
    });
  };

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-medium text-text-primary">Referrals</h1>
        <p className="text-body-regular text-text-secondary">
          Every account created through an invite link. {n(counts.rewarded)} rewarded, {n(credits)} credits paid out. Rejected rows never show to the referrer; they are here for review.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Filter referrals"
          selectedKeys={[filter]}
          onSelectionChange={(keys) => {
            const next = [...(keys as Set<string>)][0] as Filter | undefined;
            if (next) setFilter(next);
          }}
        >
          <SegmentedControlItem id="all">All {counts.all}</SegmentedControlItem>
          <SegmentedControlItem id="pending">Pending {counts.pending}</SegmentedControlItem>
          <SegmentedControlItem id="rewarded">Rewarded {counts.rewarded}</SegmentedControlItem>
          <SegmentedControlItem id="rejected">Rejected {counts.rejected}</SegmentedControlItem>
        </SegmentedControl>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-border-button-default bg-background-primary-default">
          <EmptyState icon={RiGiftLine} title="No referrals here" description="Signups through invite links appear as soon as they happen." />
        </div>
      ) : (
        <Table aria-label="Referrals" size="sm" containerClassName="rounded-2xl">
          <TableHeader>
            <TableColumn isRowHeader>Referred person</TableColumn>
            <TableColumn>Referrer workspace</TableColumn>
            <TableColumn>Status</TableColumn>
            <TableColumn>Signed up</TableColumn>
            <TableColumn>Counts until</TableColumn>
            <TableColumn>Plan</TableColumn>
            <TableColumn>Reward</TableColumn>
            <TableColumn>Invoice</TableColumn>
            <TableColumn className="text-end">Action</TableColumn>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const status = STATUS[r.status];
              const plan = r.referee.planKey ? (getPlan(r.referee.planKey)?.name ?? r.referee.planKey) : "Trial";
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body-medium text-text-primary" dir="ltr">
                        {r.referee.email ?? r.referee.maskedEmail}
                      </span>
                      <span className="truncate text-caption-1-regular text-text-tertiary">
                        {r.referee.name ?? "Not onboarded"}
                        {r.referee.workspaceName ? ` · ${r.referee.workspaceName}` : ""} · {SOURCE[r.source]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-body-regular text-text-primary">{r.referrer.workspaceName}</span>
                      <span className="font-mono text-caption-1-regular text-text-tertiary" dir="ltr">
                        {r.referrer.code ?? ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Chip variant="caption" color={status.color}>
                        {status.label}
                      </Chip>
                      {r.rejectedReason ? <span className="text-caption-1-regular text-text-tertiary">{REASON[r.rejectedReason]}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{when(r.signedUpAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{day(r.expiresAt)}</TableCell>
                  <TableCell>
                    <Chip variant="caption" color={r.referee.planKey ? "blue" : "neutral"}>
                      {plan}
                    </Chip>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {r.rewardCredits ? `${n(r.rewardCredits)} cr` : "—"}
                    {r.rewardedAt ? <span className="block text-caption-1-regular text-text-tertiary">{day(r.rewardedAt)}</span> : null}
                  </TableCell>
                  <TableCell>
                    {r.stripeInvoiceId ? (
                      <a
                        href={`https://dashboard.stripe.com/invoices/${r.stripeInvoiceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-caption-1-regular text-text-secondary underline-offset-2 hover:underline"
                        dir="ltr"
                      >
                        {r.stripeInvoiceId.slice(0, 14)}…
                      </a>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {r.status === "rewarded" ? (
                      <Button variant="secondary" size="small" disabled={pending} onClick={() => setRevoking(r)}>
                        Withdraw
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        isOpen={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        icon={RiGiftLine}
        title="Withdraw this reward?"
        description={
          revoking
            ? `The unused part of the ${n(revoking.rewardCredits ?? 0)} credits is removed from ${revoking.referrer.workspaceName} and the referral is marked as withdrawn. Credits already spent stay spent. This cannot be undone.`
            : undefined
        }
        confirmLabel="Withdraw reward"
        isPending={pending}
        onConfirm={revoke}
      />
    </div>
  );
}
