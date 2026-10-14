"use client";

import { useState } from "react";
import { RiArrowDownSLine, RiDownloadLine, RiGroupLine } from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { leadExportPath } from "@/lib/leads/constants";
import type { LeadOwnerView } from "@/lib/leads/owners";
import { SEGMENTS } from "@/lib/lists/segments";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";
import { requestLeadOffer } from "./lead-offer-dialog";
import { OwnerPortrait } from "./owner-portrait";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Title, who prepared it, status chip, contacts pill and the Download menu. No Stop, Rename or Delete here. */
export function LeadListHeader({ token, list, owner, leadFirstName }: { token: string; list: ListRow; owner: LeadOwnerView; leadFirstName: string }) {
  const meta = LIST_STATUS_META[list.status];
  const done = list.status === "completed" || list.status === "stopped";
  const [downloadOpen, setDownloadOpen] = useState(false);

  const download = (segment: string) => {
    setDownloadOpen(false);
    const a = document.createElement("a");
    a.href = leadExportPath(token, segment);
    a.download = "";
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
    // The free credits offer opens again after every download.
    requestLeadOffer();
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-4">
        <OwnerPortrait owner={owner} size={48} className="mt-0.5 hidden sm:block" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-title-2-medium text-text-primary">{list.name}</h1>
            <Chip variant="caption" color={meta.chip}>
              {meta.label}
            </Chip>
          </div>
          <p className="text-body-regular text-text-secondary">
            {done
              ? `${owner.firstName} enriched these contacts for you, ${leadFirstName}. Filter by segment or download the whole list as CSV.`
              : `${owner.firstName} is enriching these contacts for you, ${leadFirstName}. Results fill in below as they come back.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary tabular-nums" title="Contacts">
          <RiGroupLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          {fmt(list.total_rows)} {list.total_rows === 1 ? "contact" : "contacts"}
        </span>

        <Dropdown isOpen={downloadOpen} onOpenChange={setDownloadOpen}>
          <DropdownTrigger
            isDisabled={!done}
            className={cx(
              "inline-flex h-9 items-center gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary shadow-xs",
              "transition-colors hover:border-border-button-hover hover:bg-background-primary-hover",
              "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
              "disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none",
            )}
          >
            <RiDownloadLine className="size-5 text-foreground-icon-primary" aria-hidden />
            Download
            <RiArrowDownSLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          </DropdownTrigger>
          <DropdownPopover aria-label="Download segments" placement="bottom end" className="w-[260px]">
            <DropdownGroup label="CSV export">
              {SEGMENTS.map((s) => (
                <DropdownItem key={s.id} onSelect={() => download(s.id)}>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-medium text-text-primary">{s.label}</span>
                    <span className="truncate text-caption-1-regular text-text-tertiary">{s.description}</span>
                  </span>
                </DropdownItem>
              ))}
            </DropdownGroup>
          </DropdownPopover>
        </Dropdown>
      </div>
    </div>
  );
}
