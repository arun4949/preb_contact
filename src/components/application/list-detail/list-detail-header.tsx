"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowDownSLine, RiCoinLine, RiDeleteBinLine, RiDownloadLine, RiMoreFill, RiPencilLine, RiStopCircleLine } from "@remixicon/react";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { Button } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { ListDialogs, type ListDialogKind } from "@/components/application/list-card/list-dialogs";
import { LIST_STATUS_META } from "@/components/application/list-card/list-status";
import { SEGMENTS } from "@/lib/lists/segments";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";

const fmt = (n: number) => n.toLocaleString("en-US");

export interface ListDetailHeaderProps {
  list: ListRow;
  canDelete: boolean;
}

/** Breadcrumb, title + status chip, credits pill, Download, Stop, overflow (Rename · Delete). */
export function ListDetailHeader({ list, canDelete }: ListDetailHeaderProps) {
  const meta = LIST_STATUS_META[list.status];
  const done = list.status === "completed" || list.status === "stopped";
  const stoppable = ["queued", "enriching", "paused_credits", "paused_upstream"].includes(list.status);
  const [dialog, setDialog] = useState<ListDialogKind>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const router = useRouter();

  const download = (segment: string) => {
    setDownloadOpen(false);
    const a = document.createElement("a");
    a.href = `/api/lists/${list.id}/export?segment=${segment}`;
    a.download = "";
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Breadcrumb>
          <BreadcrumbItem href="/lists">Lists</BreadcrumbItem>
          <BreadcrumbItem current>{list.name}</BreadcrumbItem>
        </Breadcrumb>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDialog("rename")}
            title="Rename"
            className="min-w-0 truncate rounded-md text-start text-title-2-medium text-text-primary outline-none hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            {list.name}
          </button>
          <Chip variant="caption" color={meta.chip}>
            {meta.label}
          </Chip>
        </div>
        <p className="text-body-regular text-text-secondary">
          {done ? "Find your contacts here or filter by segment to export specifics." : "Results fill in below as contacts come back."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary tabular-nums" title="Credits used">
          <RiCoinLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          {fmt(list.credits_used)}
        </span>

        {stoppable ? (
          <Button variant="secondary" leadingIcon={RiStopCircleLine} onClick={() => setDialog("stop")}>
            Stop
          </Button>
        ) : null}

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

        <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownTrigger
            aria-label="More actions"
            className="inline-flex size-9 items-center justify-center rounded-2lg border border-border-button-default bg-background-primary-default text-foreground-icon-primary shadow-xs transition-colors hover:border-border-button-hover hover:bg-background-primary-hover outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiMoreFill className="size-5" aria-hidden />
          </DropdownTrigger>
          <DropdownPopover aria-label="List actions" placement="bottom end" className="w-[200px]">
            <DropdownGroup>
              <DropdownItem onSelect={() => { setMenuOpen(false); setDialog("rename"); }}>
                <RiPencilLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="text-body-medium">Rename</span>
              </DropdownItem>
            </DropdownGroup>
            {canDelete ? (
              <>
                <DropdownDivider />
                <DropdownGroup>
                  <DropdownItem onSelect={() => { setMenuOpen(false); setDialog("delete"); }}>
                    <RiDeleteBinLine className="size-5 text-text-error-primary" aria-hidden />
                    <span className="text-body-medium text-text-error-primary">Delete</span>
                  </DropdownItem>
                </DropdownGroup>
              </>
            ) : null}
          </DropdownPopover>
        </Dropdown>
      </div>

      <ListDialogs list={list} dialog={dialog} onClose={() => setDialog(null)} onDone={(kind) => kind === "delete" && router.push("/lists")} />
    </div>
  );
}
