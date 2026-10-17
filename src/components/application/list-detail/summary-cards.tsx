"use client";

import type { ComponentType, ReactNode } from "react";
import { RiMailLine, RiMailSendLine, RiSmartphoneLine, RiSparklingLine, RiUserSearchLine } from "@remixicon/react";
import { Focusable } from "react-aria-components";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import type { ContactQuery } from "@/lib/lists/contact-query";
import { CONNECT_RATE_META, EMAIL_LEVEL_META, EMAIL_LEVELS, type EmailLevel } from "@/lib/lists/email-levels";
import { emailFound, type EmailBreakdown, type ListInsights, type PhoneBreakdown } from "@/lib/lists/insights";
import type { ListRow } from "@/lib/supabase/queries";
import { cx } from "@/utils/cx";
import { SummaryDonut, type DonutSegment } from "./summary-donut";
import type { QueryPatch } from "./use-contact-query";

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");
const token = (chart: string) => `var(--color-${chart.replace(/^bg-/, "")})`;

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

export interface SummaryCardsProps {
  list: ListRow;
  insights: ListInsights;
  query: ContactQuery;
  onChange: (patch: QueryPatch) => void;
}

/* ---------- hover panel pieces ---------- */

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex w-[280px] flex-col gap-2 py-0.5">
      <p className="text-body-medium text-text-primary">{title}</p>
      {children}
    </div>
  );
}

function PanelRow({ swatch, label, count, hint }: { swatch: string; label: string; count: number; hint: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", swatch)} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-2 text-body-2-medium text-text-primary">
          <span className="truncate">{label}</span>
          <span className="tabular-nums">{fmt(count)}</span>
        </span>
        <span className="text-caption-1-regular text-text-tertiary">{hint}</span>
      </span>
    </li>
  );
}

function DeliverabilityPanel({ b }: { b: EmailBreakdown }) {
  return (
    <Panel title="Deliverability">
      <ul className="flex flex-col gap-2">
        {EMAIL_LEVELS.map((level) => (
          <PanelRow key={level} swatch={EMAIL_LEVEL_META[level].chart} label={EMAIL_LEVEL_META[level].label} count={b[level]} hint={EMAIL_LEVEL_META[level].bounce} />
        ))}
        <PanelRow swatch={EMAIL_LEVEL_META.not_found.chart} label={EMAIL_LEVEL_META.not_found.label} count={b.not_found} hint={EMAIL_LEVEL_META.not_found.bounce} />
      </ul>
    </Panel>
  );
}

function ConnectRatePanel({ p }: { p: PhoneBreakdown }) {
  const rates = [
    { key: "HIGHEST" as const, count: p.connect.highest },
    { key: "HIGH" as const, count: p.connect.high },
    { key: "MEDIUM" as const, count: p.connect.medium },
  ];
  const types = [
    ["Mobile", p.mobile],
    ["Landline", p.landline],
    ["VoIP", p.voip],
  ].filter(([, n]) => (n as number) > 0) as [string, number][];
  return (
    <Panel title="Connect rate">
      <ul className="flex flex-col gap-2">
        {rates.map((r) => (
          <PanelRow key={r.key} swatch={CONNECT_RATE_META[r.key].chart} label={`${CONNECT_RATE_META[r.key].label} connect rate`} count={r.count} hint={CONNECT_RATE_META[r.key].description} />
        ))}
        <PanelRow swatch={CONNECT_RATE_META.unrated.chart} label={CONNECT_RATE_META.unrated.label} count={p.connect.unrated} hint={CONNECT_RATE_META.unrated.description} />
      </ul>
      <dl className="mt-1 flex flex-col gap-1 border-t border-separator-border pt-2 text-body-2-regular text-text-secondary">
        <div className="flex justify-between gap-2">
          <dt>Ownership confirmed</dt>
          <dd className="tabular-nums text-text-primary">
            {fmt(p.ownership.confirmed)} of {fmt(p.found)}
          </dd>
        </div>
        {types.length > 0 ? (
          <div className="flex justify-between gap-2">
            <dt>Line types</dt>
            <dd className="text-end text-text-primary">{types.map(([t, n]) => `${t} ${fmt(n)}`).join(", ")}</dd>
          </div>
        ) : null}
      </dl>
    </Panel>
  );
}

/* ---------- card ---------- */

function Card({
  icon: IconCmp,
  label,
  found,
  processed,
  segments,
  selectedKey,
  onSelect,
  remainderKey,
  panel,
  note,
  ariaLabel,
}: {
  icon: Icon;
  label: string;
  found: number;
  processed: number;
  segments: DonutSegment[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  remainderKey?: string;
  panel?: ReactNode;
  note?: ReactNode;
  ariaLabel: string;
}) {
  const figure = (
    <div className="flex items-end justify-between gap-4">
      <span className="flex items-baseline gap-1.5">
        <span className="text-display-4-medium text-text-primary tabular-nums">{fmt(found)}</span>
        <span className="text-body-regular text-text-tertiary tabular-nums">/ {fmt(processed)}</span>
      </span>
      <span className="flex items-center gap-3">
        <span className="text-body-2-medium text-text-secondary tabular-nums">{pct(found, processed)}</span>
        <SummaryDonut segments={segments} total={processed} selectedKey={selectedKey} onSelect={onSelect} remainderKey={remainderKey} />
      </span>
    </div>
  );
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5" aria-label={ariaLabel}>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-secondary-default">
          <IconCmp className="size-5 text-foreground-icon-primary" aria-hidden />
        </span>
        <span className="text-body-medium text-text-secondary">{label}</span>
      </div>
      {panel ? (
        <TooltipTrigger delay={200}>
          <Focusable>
            <div tabIndex={0} className="-m-1 rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
              {figure}
            </div>
          </Focusable>
          <Tooltip size="md" className="max-w-none" placement="bottom" offset={6}>
            {panel}
          </Tooltip>
        </TooltipTrigger>
      ) : (
        figure
      )}
      {note ? <div className="mt-auto">{note}</div> : null}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-background-secondary-default px-3 py-2 text-caption-1-medium text-text-secondary">
      <RiSparklingLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
      {children}
    </p>
  );
}

function emailSegments(b: EmailBreakdown): DonutSegment[] {
  return EMAIL_LEVELS.map((level: EmailLevel) => ({
    key: level,
    value: b[level],
    color: token(EMAIL_LEVEL_META[level].chart),
    activeColor: token(`${EMAIL_LEVEL_META[level].chart}-active`),
    label: `${EMAIL_LEVEL_META[level].label}: ${fmt(b[level])}`,
  }));
}

const GRID: Record<number, string> = { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4" };

/**
 * One card per ordered field: found over processed, a ring with the
 * level breakdown, a hover panel with the detail and a note when catch-all
 * addresses were upgraded. Work-email and phone rings filter the table.
 */
export function SummaryCards({ list, insights, query, onChange }: SummaryCardsProps) {
  const processed = Math.max(insights.processed, list.processed_rows);
  const wantsWork = list.enrich_fields.includes("work_email");
  const wantsPersonal = list.enrich_fields.includes("personal_email");
  const wantsPhone = list.enrich_fields.includes("mobile_phone");
  const reverse = list.reverse_lookup || list.identified_rows > 0 || insights.identified > 0;
  const cards: ReactNode[] = [];

  if (wantsWork) {
    const b = insights.work_email;
    cards.push(
      <Card
        key="work"
        icon={RiMailLine}
        label="Work emails"
        found={emailFound(b)}
        processed={processed}
        segments={emailSegments(b)}
        selectedKey={query.email === "all" ? null : query.email}
        onSelect={(key) => onChange({ email: query.email === key ? "all" : (key as ContactQuery["email"]) })}
        remainderKey="not_found"
        panel={<DeliverabilityPanel b={b} />}
        note={b.probable > 0 ? <Note>{fmt(b.probable)} catch-all {b.probable === 1 ? "email" : "emails"} revealed as probably valid</Note> : null}
        ariaLabel={`Work emails: ${fmt(emailFound(b))} of ${fmt(processed)}`}
      />,
    );
  }
  if (wantsPersonal) {
    const b = insights.personal_email;
    cards.push(
      <Card
        key="personal"
        icon={RiMailSendLine}
        label="Personal emails"
        found={emailFound(b)}
        processed={processed}
        segments={emailSegments(b)}
        panel={<DeliverabilityPanel b={b} />}
        note={b.probable > 0 ? <Note>{fmt(b.probable)} catch-all {b.probable === 1 ? "email" : "emails"} revealed as probably valid</Note> : null}
        ariaLabel={`Personal emails: ${fmt(emailFound(b))} of ${fmt(processed)}`}
      />,
    );
  }
  if (wantsPhone) {
    const p = insights.phone;
    cards.push(
      <Card
        key="phone"
        icon={RiSmartphoneLine}
        label="Mobile phones"
        found={p.mobile}
        processed={processed}
        segments={[
          { key: "found", value: p.mobile, color: "var(--color-chart-4)", activeColor: "var(--color-chart-4-active)", label: `Mobile: ${fmt(p.mobile)}` },
          { key: "landline", value: p.found - p.mobile, color: "var(--color-chart-5)", activeColor: "var(--color-chart-5-active)", label: `Other numbers: ${fmt(p.found - p.mobile)}` },
        ]}
        selectedKey={query.phone === "found" ? "found" : query.phone === "not_found" ? "not_found" : null}
        onSelect={(key) => {
          const next = key === "not_found" ? "not_found" : "found";
          onChange({ phone: query.phone === next ? null : next });
        }}
        remainderKey="not_found"
        panel={<ConnectRatePanel p={p} />}
        note={p.ownership.confirmed > 0 ? <Note>{fmt(p.ownership.confirmed)} {p.ownership.confirmed === 1 ? "number" : "numbers"} with confirmed ownership</Note> : null}
        ariaLabel={`Mobile phones: ${fmt(p.mobile)} of ${fmt(processed)}`}
      />,
    );
  }
  if (reverse) {
    const n = Math.max(insights.identified, list.identified_rows);
    cards.push(
      <Card
        key="identified"
        icon={RiUserSearchLine}
        label="Identified"
        found={n}
        processed={processed}
        segments={[{ key: "identified", value: n, color: "var(--color-chart-1)", label: `Identified: ${fmt(n)}` }]}
        ariaLabel={`Identified: ${fmt(n)} of ${fmt(processed)}`}
      />,
    );
  }
  if (cards.length === 0) return null;

  return <div className={cx("grid grid-cols-1 gap-4 sm:grid-cols-2", GRID[Math.min(4, cards.length)])}>{cards}</div>;
}
