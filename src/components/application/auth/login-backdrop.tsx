import {
  RiAddLine,
  RiAlertLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiCoinLine,
  RiDownloadLine,
  RiGroupLine,
  RiMoreFill,
  RiNotificationLine,
  RiSearchLine,
  RiSmartphoneLine,
  RiUserUnfollowLine,
} from "@remixicon/react";
import { Badge } from "@/components/base/badges/badge";
import { Chip } from "@/components/base/badges/chip";
import { StatusDot } from "@/components/base/badges/status-dot";
import { Logo, LogoName } from "@/components/foundations/brand/logo";
import { cx } from "@/utils/cx";

/**
 * Decorative, blurred replica of the lists dashboard behind the sign-in card
 * (the "you are unlocking this" backdrop). Pure server markup: no state, no
 * links, no controls, `inert` and `aria-hidden`, so it never takes focus,
 * clicks or screen-reader attention away from the card. The canvas is drawn
 * at a fixed desktop width and scaled per breakpoint, so a phone shows the
 * whole three-column grid as a small composition instead of one card.
 *
 * Every number and name here is fictional. The look mirrors `AppHeader`,
 * the lists page title row, `ListsToolbar` and `ListCard` / `ContactGauge`
 * with the same tokens, so it follows light and dark mode automatically.
 */

type FakeStatus = { kind: "done"; date: string } | { kind: "running"; progress: number } | { kind: "paused" };

interface FakeList {
  name: string;
  total: number;
  phones: number;
  valid: number;
  catchAll: number;
  duplicates: number;
  owner: string;
  status: FakeStatus;
}

const LISTS: FakeList[] = [
  { name: "Senior backend engineers, Berlin", total: 412, phones: 286, valid: 298, catchAll: 47, duplicates: 9, owner: "Mara Lindqvist", status: { kind: "done", date: "Oct 14, 2026" } },
  { name: "Head of Sales, DACH", total: 180, phones: 121, valid: 134, catchAll: 18, duplicates: 4, owner: "Jonas Reuter", status: { kind: "done", date: "Oct 12, 2026" } },
  { name: "Product designers Q4", total: 96, phones: 38, valid: 41, catchAll: 7, duplicates: 2, owner: "Mara Lindqvist", status: { kind: "running", progress: 62 } },
  { name: "CFO search, London", total: 64, phones: 44, valid: 49, catchAll: 6, duplicates: 1, owner: "Priya Natarajan", status: { kind: "done", date: "Oct 9, 2026" } },
  { name: "Data scientists, remote", total: 230, phones: 97, valid: 118, catchAll: 21, duplicates: 6, owner: "Jonas Reuter", status: { kind: "paused" } },
  { name: "Recruiters shortlist", total: 48, phones: 31, valid: 36, catchAll: 5, duplicates: 0, owner: "Priya Natarajan", status: { kind: "done", date: "Oct 6, 2026" } },
  { name: "Frontend leads, Amsterdam", total: 142, phones: 88, valid: 101, catchAll: 15, duplicates: 3, owner: "Mara Lindqvist", status: { kind: "done", date: "Oct 2, 2026" } },
  { name: "VP Engineering, Nordics", total: 57, phones: 39, valid: 43, catchAll: 5, duplicates: 1, owner: "Jonas Reuter", status: { kind: "done", date: "Sep 29, 2026" } },
  { name: "Account executives, SaaS", total: 318, phones: 204, valid: 231, catchAll: 36, duplicates: 11, owner: "Priya Natarajan", status: { kind: "done", date: "Sep 26, 2026" } },
  { name: "DevOps engineers, Munich", total: 121, phones: 73, valid: 86, catchAll: 13, duplicates: 2, owner: "Mara Lindqvist", status: { kind: "running", progress: 24 } },
  { name: "Marketing managers, DACH", total: 204, phones: 129, valid: 149, catchAll: 24, duplicates: 5, owner: "Jonas Reuter", status: { kind: "done", date: "Sep 22, 2026" } },
  { name: "Hiring managers, Q3 pipeline", total: 73, phones: 51, valid: 55, catchAll: 7, duplicates: 1, owner: "Priya Natarajan", status: { kind: "done", date: "Sep 18, 2026" } },
  { name: "Mobile developers, Vienna", total: 88, phones: 57, valid: 64, catchAll: 9, duplicates: 2, owner: "Mara Lindqvist", status: { kind: "done", date: "Sep 15, 2026" } },
  { name: "Finance controllers, Zurich", total: 39, phones: 26, valid: 29, catchAll: 4, duplicates: 0, owner: "Jonas Reuter", status: { kind: "done", date: "Sep 11, 2026" } },
  { name: "Customer success, EMEA", total: 166, phones: 108, valid: 122, catchAll: 18, duplicates: 4, owner: "Priya Natarajan", status: { kind: "done", date: "Sep 8, 2026" } },
];

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");

export function LoginBackdrop() {
  return (
    <div aria-hidden inert className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      <div
        className={cx(
          "absolute top-0 left-1/2 w-full origin-top -translate-x-1/2 animate-page-enter blur-[5px]",
          "sm:w-[1280px] sm:scale-[0.6] md:scale-[0.78] lg:scale-[0.92] xl:w-full xl:scale-100",
        )}
      >
        <FakeHeader />
        <div className="mx-auto flex w-full flex-col gap-6 px-4 py-8 sm:px-10">
          <FakeTitleRow />
          <FakeToolbar />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 2xl:grid-cols-4">
            {LISTS.map((list) => (
              <FakeListCard key={list.name} list={list} />
            ))}
          </div>
        </div>
      </div>
      {/* Scrim: the canvas stays a hint, the card stays the subject. */}
      <div className="absolute inset-0 bg-gradient-to-b from-background-full/70 via-background-full/40 to-background-full/90" />
    </div>
  );
}

function FakeHeader() {
  return (
    <div className="border-b border-separator-border bg-background-primary-default">
      <div className="mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-10">
        <div className="flex items-center gap-4 sm:gap-6">
          <span className="hidden sm:flex">
            <LogoName height={24} />
          </span>
          <Logo size={28} className="sm:hidden" />
          <div className="flex h-16 items-center gap-1">
            <span className="relative inline-flex h-full items-center px-2.5 text-body-medium text-accent-600">
              Lists
              <span className="absolute bottom-0 left-0 h-0.5 w-full bg-accent-600" />
            </span>
            <span className="inline-flex h-full items-center px-2.5 text-body-regular text-text-primary">Enrich</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex">
            <PrimaryPill />
          </span>
          <span className="flex size-9 items-center justify-center rounded-full bg-button-primary text-text-white shadow-xs sm:hidden">
            <RiAddLine className="size-5" />
          </span>
          <span className="flex size-9 items-center justify-center rounded-2lg">
            <RiNotificationLine className="size-5 text-foreground-icon-primary" />
          </span>
          <span className="flex h-9 items-center gap-1.5 rounded-2lg px-2 sm:px-2.5">
            <RiCoinLine className="size-5 text-foreground-icon-primary" />
            <span className="hidden text-body-medium text-text-primary sm:inline">Credits</span>
            <span className="hidden text-body-medium text-text-primary tabular-nums sm:inline">1,240</span>
          </span>
          <Initials name="ML" size="size-8" />
        </div>
      </div>
    </div>
  );
}

function PrimaryPill() {
  return (
    <span className="inline-flex h-9 items-center gap-0.5 rounded-full bg-button-primary p-2 text-body-medium text-text-white shadow-xs">
      <RiAddLine className="size-5 shrink-0" />
      <span className="px-1">New list</span>
    </span>
  );
}

function Initials({ name, size }: { name: string; size: string }) {
  return (
    <span className={cx("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-700 text-headline-semibold text-white", size)}>
      {name}
    </span>
  );
}

function FakeTitleRow() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Initials name="NR" size="size-10" />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-title-2-medium text-text-primary">Lists</span>
            <Badge>{LISTS.length}</Badge>
          </div>
          <span className="text-body-regular text-text-secondary">Upload a spreadsheet and we find verified emails and phones.</span>
        </div>
      </div>
      <PrimaryPill />
    </div>
  );
}

const field = "flex h-9 items-center gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default px-2.5 text-body-medium text-text-primary shadow-xs";

function FakeToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={field}>
        <StatusDot color="green" className="me-1" />
        Completed
        <ChevronDown />
      </span>
      <span className={field}>
        Owned by: Everyone
        <ChevronDown />
      </span>
      <span className={cx(field, "ms-auto w-full gap-2 text-text-placeholder sm:w-[280px]")}>
        <RiSearchLine className="size-5 text-foreground-icon-secondary" />
        Search lists…
      </span>
      <span className="hidden h-5 min-w-5 items-center justify-center rounded-sm border sm:inline-flex border-border-button-default px-1 text-caption-1-medium text-text-secondary">/</span>
    </div>
  );
}

function ChevronDown() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FakeListCard({ list }: { list: FakeList }) {
  const s = list.status;
  const done = s.kind === "done";
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
      <div className="flex h-11 items-center justify-between gap-2 bg-background-secondary-default ps-4 pe-2">
        <div className="flex items-center gap-2 text-body-2-medium">
          {s.kind === "done" ? (
            <>
              <RiCheckLine className="size-4 shrink-0 text-notification-success-foreground" />
              <span className="text-text-primary">Enriched {s.date}</span>
            </>
          ) : s.kind === "running" ? (
            <>
              <span className="size-2 rounded-full bg-chart-1" />
              <span className="text-text-primary">Enriching…</span>
              <span className="text-text-secondary tabular-nums">{s.progress}%</span>
            </>
          ) : (
            <>
              <RiAlertLine className="size-4 shrink-0 text-status-orange-text" />
              <span className="text-text-primary">Paused, out of credits</span>
            </>
          )}
        </div>
        <span className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary">
          <RiMoreFill className="size-5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-center gap-2 text-center">
          <RiGroupLine className="size-5 shrink-0 text-foreground-icon-secondary" />
          <span className="truncate text-headline-medium text-text-primary">{list.name}</span>
          <RiArrowRightSLine className="size-5 shrink-0 text-foreground-icon-tertiary" />
        </div>

        <FakeGauge total={list.total} valid={list.valid} catchAll={list.catchAll} />

        <ul className="flex flex-col gap-2">
          <Row lead={<RiSmartphoneLine className="size-4 text-foreground-icon-secondary" />} chip={pct(list.phones, list.total)} label="Mobile phones" value={list.phones} />
          <Row lead={<span className="size-3 rounded-[4px] bg-chart-1" />} chip={pct(list.valid, list.total)} label="Valid emails" value={list.valid} />
          <Row lead={<span className="size-3 rounded-[4px] bg-chart-8" />} chip={pct(list.catchAll, list.total)} label="Catch-all emails" value={list.catchAll} />
          <Row lead={<RiUserUnfollowLine className="size-4 text-foreground-icon-secondary" />} label="Duplicates removed" value={list.duplicates} />
        </ul>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <span
            className={cx(
              "inline-flex h-9 w-full items-center justify-center gap-0.5 rounded-2lg border border-border-button-default p-2 text-body-medium",
              done ? "bg-background-primary-default text-text-primary shadow-xs" : "bg-background-primary-disabled text-text-tertiary",
            )}
          >
            <RiDownloadLine className="size-5 shrink-0" />
            <span className="px-1">Download All ({fmt(list.total)})</span>
          </span>
          <span className="text-center text-caption-1-regular text-text-tertiary">Created by {list.owner}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ lead, chip, label, value }: { lead: React.ReactNode; chip?: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-3">
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

/* Static copy of the ContactGauge geometry (physical coordinates: chart). */
const W = 200;
const R = 84;
const STROKE = 16;
const CY = 4 + R + STROKE / 2;
const H = CY + STROKE / 2 + 2;
const ARC = `M ${W / 2 - R} ${CY} A ${R} ${R} 0 0 1 ${W / 2 + R} ${CY}`;
/** Half the stroke as a fraction of the arc, so round caps end where the share ends. */
const CAP = STROKE / 2 / (Math.PI * R);
const GAP = 3 / 180;

function FakeGauge({ total, valid, catchAll }: { total: number; valid: number; catchAll: number }) {
  const v = valid / total;
  const c = catchAll / total;
  const segments = [
    { key: "valid", start: 0, end: v, stroke: "var(--color-chart-1)" },
    { key: "catch", start: v + GAP, end: Math.min(1, v + GAP + c), stroke: "var(--color-chart-8)" },
  ];
  return (
    <div className="relative mx-auto w-[200px]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible">
        <path d={ARC} fill="none" stroke="var(--color-chart-track)" strokeWidth={STROKE} strokeLinecap="round" pathLength={1} strokeDasharray={`${1 - CAP * 2} 1`} strokeDashoffset={-CAP} />
        {segments.map((seg) => {
          const length = Math.max(0, seg.end - seg.start - CAP * 2);
          return (
            <path
              key={seg.key}
              d={ARC}
              fill="none"
              stroke={seg.stroke}
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${length} 1`}
              strokeDashoffset={-(seg.start + CAP)}
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-body-2-regular text-text-secondary">Contacts</span>
        <span className="text-title-1-medium text-text-primary tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  );
}
