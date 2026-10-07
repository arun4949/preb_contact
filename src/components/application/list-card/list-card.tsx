"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiGroupLine,
  RiMoreFill,
  RiPencilLine,
  RiStopCircleLine,
  RiUserUnfollowLine,
} from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { ConfirmDialog, Dialog } from "@/components/base/dialog/dialog";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { Input } from "@/components/base/input/input";
import { useToast } from "@/components/base/toast/toast";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { ComposerLoader } from "@/components/application/composer-loader/composer-loader";
import { ContactGauge } from "@/components/application/contact-gauge/contact-gauge";
import { deleteList, renameList, stopList } from "@/lib/lists/actions";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";
import { LIST_STATUS_META } from "./list-status";

/** Flip on when `/api/lists/[id]/export` exists (sprint day 4). */
const EXPORT_READY = false;
const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export interface ListCardProps {
  list: ListRow;
  ownerName: string | null;
  canDelete: boolean;
}

type DialogKind = "rename" | "stop" | "delete" | null;

/** Dashboard card (Figma 1015:30): status strip, title, gauge, metric rows, Download, overflow menu. */
export function ListCard({ list, ownerName, canDelete }: ListCardProps) {
  const meta = LIST_STATUS_META[list.status];
  const running = meta.running;
  const done = list.status === "completed" || list.status === "stopped";
  const paused = list.status === "paused_credits" || list.status === "paused_upstream" || list.status === "failed";
  const base = list.enrichable_rows || list.total_rows;
  const progress = base > 0 ? Math.min(100, Math.round((list.processed_rows / base) * 100)) : 0;
  const href = `/lists/${list.id}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [name, setName] = useState(list.name);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string | (() => string)) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(typeof success === "function" ? success() : success);
        setDialog(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  const strip = (
    <div className="flex h-11 items-center justify-between gap-2 ps-4 pe-2">
      <div className="flex min-w-0 items-center gap-2 text-body-2-medium">
        {done ? (
          <>
            <RiCheckLine className="size-4 shrink-0 text-notification-success-foreground" aria-hidden />
            <span className="truncate text-text-primary">
              {list.status === "completed" ? "Enriched" : "Stopped"} {fmtDate(list.completed_at ?? list.started_at)}
            </span>
          </>
        ) : running ? (
          <>
            <AgentThinking label={list.status === "stopping" ? "Finishing in-flight contacts…" : list.status === "queued" ? "Queued…" : "Enriching…"} className="text-body-2-medium" showTimer={false} />
            <span className="text-text-secondary tabular-nums">{progress}%</span>
          </>
        ) : paused ? (
          <>
            <RiAlertLine className="size-4 shrink-0 text-status-orange-text" aria-hidden />
            <span className="truncate text-text-primary">{meta.label}</span>
          </>
        ) : (
          <span className="truncate text-text-secondary">{meta.label}</span>
        )}
      </div>
      <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownTrigger aria-label={`Actions for ${list.name}`} className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover">
          <RiMoreFill className="size-5" aria-hidden />
        </DropdownTrigger>
        <DropdownPopover aria-label="List actions" placement="bottom end" className="w-[200px]">
          <DropdownGroup>
            <DropdownItem onSelect={() => { setMenuOpen(false); setName(list.name); setDialog("rename"); }}>
              <RiPencilLine className="size-5 text-foreground-icon-secondary" aria-hidden />
              <span className="text-body-medium">Rename</span>
            </DropdownItem>
            {running || paused ? (
              <DropdownItem onSelect={() => { setMenuOpen(false); setDialog("stop"); }}>
                <RiStopCircleLine className="size-5 text-foreground-icon-secondary" aria-hidden />
                <span className="text-body-medium">Stop</span>
              </DropdownItem>
            ) : null}
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
  );

  return (
    <article
      className={cx(
        "group/card relative flex flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default",
        "transition-[border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:border-border-button-hover hover:shadow-xs motion-reduce:hover:translate-y-0",
      )}
    >
      {running ? (
        <ComposerLoader active surface={false} radius={0} line={1.5} bloom={10} bloomStrength={0.18} intensity={0.55} arc={90} className="bg-background-secondary-default">
          {strip}
        </ComposerLoader>
      ) : (
        <div className="bg-background-secondary-default">{strip}</div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-5">
        <Link
          href={href}
          className="flex items-center justify-center gap-2 rounded-lg text-center outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiGroupLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          <span className="truncate text-headline-medium text-text-primary">{list.name}</span>
          <RiArrowRightSLine className="size-5 shrink-0 text-foreground-icon-tertiary transition-transform group-hover/card:translate-x-0.5 rtl:rotate-180" aria-hidden />
        </Link>

        <ContactGauge total={list.total_rows} valid={list.found_work_email} risky={list.risky_email} sweeping={running} />

        <ul className="flex flex-col gap-2">
          <MetricRow chip={pct(list.found_work_email, base)} color="purple" label="Valid emails" value={list.found_work_email} />
          <MetricRow chip={pct(list.risky_email, base)} color="yellow" label="Risky emails" value={list.risky_email} />
          {list.enrich_fields.includes("mobile_phone") ? (
            <MetricRow chip={pct(list.found_phone, base)} color="cyan" label="Mobile phones" value={list.found_phone} />
          ) : null}
          <li className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center text-foreground-icon-secondary">
              <RiUserUnfollowLine className="size-4" aria-hidden />
            </span>
            <span className="flex-1 text-body-regular text-text-secondary">Duplicates removed</span>
            <span className="text-body-medium text-text-primary tabular-nums">{fmt(list.duplicates_removed)}</span>
          </li>
        </ul>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Button variant="secondary" leadingIcon={RiDownloadLine} className="w-full" disabled={!done || !EXPORT_READY} title={done ? (EXPORT_READY ? undefined : "CSV export is coming soon") : "Available when the list finishes"}>
            Download All ({fmt(list.enrichable_rows || list.total_rows)})
          </Button>
          {ownerName ? <p className="text-center text-caption-1-regular text-text-tertiary">Created by {ownerName}</p> : null}
        </div>
      </div>

      <Dialog
        isOpen={dialog === "rename"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Rename list"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={() => run(() => renameList(list.id, name), "List renamed")} disabled={pending || !name.trim()}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <Input label="Name" value={name} onChange={setName} autoFocus maxLength={120} />
      </Dialog>

      <ConfirmDialog
        isOpen={dialog === "stop"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Stop this list?"
        description="Contacts already in progress will finish and be charged. Nothing new will be submitted."
        confirmLabel="Stop list"
        tone="primary"
        isPending={pending}
        onConfirm={() => run(() => stopList(list.id), list.status === "queued" ? "List stopped" : "List is stopping — in-flight contacts will finish")}
      />

      <ConfirmDialog
        isOpen={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Delete this list?"
        description="The list, its rows and the uploaded file are removed permanently. Credits already used are not refunded."
        confirmLabel="Delete list"
        isPending={pending}
        onConfirm={() => run(() => deleteList(list.id), "List deleted")}
      />
    </article>
  );
}

function MetricRow({ chip, color, label, value }: { chip: string; color: "purple" | "yellow" | "cyan"; label: string; value: number }) {
  return (
    <li className="flex items-center gap-3">
      <Chip variant="caption" color={color} className="w-14 justify-center tabular-nums">
        {chip}
      </Chip>
      <span className="flex-1 text-body-regular text-text-secondary">{label}</span>
      <span className="text-body-medium text-text-primary tabular-nums">{fmt(value)}</span>
    </li>
  );
}
