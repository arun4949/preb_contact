"use client";

import { useState } from "react";
import Link from "next/link";
import { RiCoinLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Dropdown, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ProgressBar } from "@/components/base/progress-bar/progress-bar";
import { buttonStyles } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import type { CreditSummary } from "@/lib/supabase/queries";

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Header credits trigger + balance panel (Figma 1015:35). Red dot when < 10 % of the plan remains. */
export function CreditsDropdown({ summary }: { summary: CreditSummary }) {
  const [open, setOpen] = useState(false);
  const low = summary.planCredits > 0 && summary.available < summary.planCredits * 0.1;

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger
        aria-label={`Credits: ${fmt(summary.available)} available`}
        className={cx(buttonStyles.base, buttonStyles.size.medium, buttonStyles.variant.ghost, "relative gap-1.5 px-2.5")}
      >
        <RiCoinLine className="size-5 shrink-0 text-foreground-icon-primary" aria-hidden />
        <span className="hidden text-body-medium sm:inline">Credits</span>
        <span className="text-body-medium tabular-nums">{fmt(summary.available)}</span>
        {low ? (
          <span aria-hidden className="absolute end-1.5 top-1.5 size-2 rounded-full bg-notification-error-foreground ring-2 ring-background-primary-default" />
        ) : null}
      </DropdownTrigger>
      <DropdownPopover aria-label="Credit balance" placement="bottom end" className="w-[300px] p-0" dialogClassName="gap-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <span className="text-headline-medium text-text-primary">Credit balance</span>
          {summary.isTrial ? (
            <Chip variant="caption" color="purple">
              Trial · {fmt(summary.planCredits)} credits
            </Chip>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-body-regular text-text-secondary">
              <RiCoinLine className="size-4 text-foreground-icon-secondary" aria-hidden />
              Available
            </span>
            <span className={cx("text-body-medium tabular-nums", low ? "text-text-error-primary" : "text-text-primary")}>
              {fmt(summary.available)} / {fmt(summary.planCredits)}
            </span>
          </div>
          <ProgressBar
            aria-label="Credits remaining"
            value={summary.available}
            maxValue={Math.max(1, summary.planCredits)}
            tone={low ? "error" : "accent"}
            size="sm"
          />
          <p className="text-body-2-regular text-text-tertiary">
            {summary.nextExpiry
              ? `${fmt(summary.nextExpiry.amount)} credits expire on ${fmtDate(summary.nextExpiry.at)}`
              : "No credits yet — choose a plan to get started."}
          </p>
        </div>
        <div className="border-t border-separator-border px-2 py-2">
          <Link
            href="/lists?settings=billing"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center rounded-2lg px-3 py-2 text-body-medium text-accent-600 outline-none transition-colors hover:bg-dropdown-item-hover-background focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            Manage credits
          </Link>
        </div>
      </DropdownPopover>
    </Dropdown>
  );
}
