"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiGroupLine,
  RiMoreFill,
  RiPencilLine,
  RiSmartphoneLine,
  RiStopCircleLine,
  RiUserUnfollowLine,
} from "@remixicon/react";
import { Chip } from "@/components/base/badges/chip";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { AgentThinking } from "@/components/application/agent-thinking/agent-thinking";
import { ComposerLoader } from "@/components/application/composer-loader/composer-loader";
import { ContactGauge, type GaugeKey } from "@/components/application/contact-gauge/contact-gauge";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";
import { ListDialogs, type ListDialogKind } from "./list-dialogs";
import { LIST_STATUS_META, listStatusLabel } from "./list-status";
const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export interface ListCardProps {
  list: ListRow;
  ownerName: string | null;
  canDelete: boolean;
}

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
  const [dialog, setDialog] = useState<ListDialogKind>(null);
  /** Outcome focused on the gauge or its row: the gauge names it, the other rows dim. */
  const [active, setActive] = useState<GaugeKey | null>(null);

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
            <span className="truncate text-text-primary">{listStatusLabel(list)}</span>
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
            <DropdownItem onSelect={() => { setMenuOpen(false); setDialog("rename"); }}>
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

        <ContactGauge
          total={list.total_rows}
          base={base}
          valid={list.found_work_email}
          catchAll={list.risky_email}
          active={active}
          onActiveChange={setActive}
          sweeping={running}
        />

        <ul className="flex flex-col gap-2">
          {list.enrich_fields.includes("mobile_phone") ? (
            <MetricRow lead={<RiSmartphoneLine className="size-4 text-foreground-icon-secondary" aria-hidden />} chip={pct(list.found_phone, base)} label="Mobile phones" value={list.found_phone} />
          ) : null}
          <MetricRow
            lead={<Swatch className="bg-chart-1" />}
            chip={pct(list.found_work_email, base)}
            label="Valid emails"
            value={list.found_work_email}
            dimmed={active !== null && active !== "valid"}
            onHover={list.found_work_email > 0 ? (on) => setActive(on ? "valid" : null) : undefined}
          />
          <MetricRow
            lead={<Swatch className="bg-chart-8" />}
            chip={pct(list.risky_email, base)}
            label="Catch-all emails"
            value={list.risky_email}
            dimmed={active !== null && active !== "catch_all"}
            onHover={list.risky_email > 0 ? (on) => setActive(on ? "catch_all" : null) : undefined}
          />
          <MetricRow lead={<RiUserUnfollowLine className="size-4 text-foreground-icon-secondary" aria-hidden />} label="Duplicates removed" value={list.duplicates_removed} />
        </ul>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {done ? (
            <ButtonLink href={`/api/lists/${list.id}/export?segment=all`} variant="secondary" leadingIcon={RiDownloadLine} className="w-full" download>
              Download All ({fmt(list.total_rows)})
            </ButtonLink>
          ) : (
            <Button variant="secondary" leadingIcon={RiDownloadLine} className="w-full" disabled title="Available when the list finishes">
              Download All ({fmt(list.total_rows)})
            </Button>
          )}
          {ownerName ? <p className="text-center text-caption-1-regular text-text-tertiary">Created by {ownerName}</p> : null}
        </div>
      </div>

      <ListDialogs list={list} dialog={dialog} onClose={() => setDialog(null)} />
    </article>
  );
}

/** Legend swatch in the exact gauge colour (the BoardUI chart-legend recipe). */
function Swatch({ className }: { className: string }) {
  return <span className={cx("size-3 rounded-[4px]", className)} aria-hidden />;
}

/**
 * Metric row: lead (swatch or icon) · label · percent chip · count. Rows
 * that are on the gauge pass `onHover` and dim while another outcome is
 * focused, like a chart legend; the others are plain.
 */
function MetricRow({
  lead,
  chip,
  label,
  value,
  dimmed = false,
  onHover,
}: {
  lead: ReactNode;
  chip?: string;
  label: string;
  value: number;
  dimmed?: boolean;
  onHover?: (on: boolean) => void;
}) {
  return (
    <li
      className={cx("flex items-center gap-3 transition-opacity duration-200 ease-out", dimmed && "opacity-50")}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
    >
      <span className="flex size-7 shrink-0 items-center justify-center">{lead}</span>
      <span className="flex-1 text-body-regular text-text-secondary">{label}</span>
      {chip !== undefined ? (
        <Chip variant="caption" color="soft" className="w-14 justify-center tabular-nums">
          {chip}
        </Chip>
      ) : null}
      <span className="min-w-10 text-end text-body-medium text-text-primary tabular-nums">{fmt(value)}</span>
    </li>
  );
}
