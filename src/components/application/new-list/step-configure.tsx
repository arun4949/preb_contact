"use client";

import { useMemo, useState, useTransition } from "react";
import { RiCoinLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { CheckboxCard } from "@/components/base/checkbox/checkbox-card";
import { Chip } from "@/components/base/badges/chip";
import { Input } from "@/components/base/input/input";
import { ProgressBar } from "@/components/base/progress-bar/progress-bar";
import { useToast } from "@/components/base/toast/toast";
import { estimateCredits, type EnrichmentField } from "@/lib/credits/estimate";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { startList, type ParseSummary } from "@/lib/lists/actions";
import { cx } from "@/utils/cx";

const fmt = (n: number) => n.toLocaleString("en-US");
const PRESETS = [500, 1000, 2500, 5000];

const FIELD_CARDS: { key: EnrichmentField; title: string; description: string }[] = [
  { key: "work_email", title: "Work email", description: "Verified business email" },
  { key: "personal_email", title: "Personal email", description: "Direct reach · recruiting use only" },
  { key: "mobile_phone", title: "Mobile phone", description: "Mobile numbers; landlines are free" },
];

export interface StepConfigureProps {
  listId: string;
  defaultName: string;
  summary: ParseSummary;
  creditsAvailable: number;
  onStarting: () => void;
}

/** Step 3 (Figma 1015:43): enrichment level cards, name, rows to enrich, estimate card, Start. */
export function StepConfigure({ listId, defaultName, summary, creditsAvailable, onStarting }: StepConfigureProps) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<EnrichmentField[]>(["work_email"]);
  const [name, setName] = useState(defaultName);
  const [rowsText, setRowsText] = useState(String(summary.enrichable));

  const billable = Math.max(0, summary.enrichable - summary.cached);
  const rowsWanted = Math.max(0, Math.min(Number(rowsText.replace(/[^\d]/g, "")) || 0, summary.enrichable));
  const rows = Math.min(rowsWanted, billable);
  const estimate = useMemo(() => estimateCredits(rows, fields), [rows, fields]);
  const short = Math.max(0, estimate.typical - creditsAvailable);
  const canStart = fields.length > 0 && name.trim().length > 0 && rowsWanted > 0 && short === 0 && !pending;

  const toggle = (key: EnrichmentField, on: boolean) =>
    setFields((prev) => (on ? [...new Set([...prev, key])] : prev.filter((f) => f !== key)));

  const submit = () =>
    start(async () => {
      onStarting();
      const res = await startList(listId, { name, fields, rowLimit: rowsWanted < summary.enrichable ? rowsWanted : null });
      if (res?.error) toast.error(res.error);
    });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-headline-medium text-text-primary">Enrichment level</h2>
          <p className="text-body-regular text-text-secondary">Choose what to add to each contact.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {FIELD_CARDS.map((c) => (
            <CheckboxCard
              key={c.key}
              isSelected={fields.includes(c.key)}
              onChange={(on) => toggle(c.key, on)}
              title={
                <span className="flex items-center gap-2">
                  {c.title}
                  <Chip variant="caption" color="soft">
                    {CREDIT_COST[c.key]} {CREDIT_COST[c.key] === 1 ? "credit" : "credits"}
                  </Chip>
                </span>
              }
              description={c.description}
              className={cx("items-start", fields.includes(c.key) && "border-accent-600")}
            />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input label="Name this list" placeholder="e.g. Sales Directors in NYC" value={name} onChange={setName} maxLength={120} isRequired />
        <div className="flex flex-col gap-1.5">
          <span className="text-body-medium text-text-primary">Rows to enrich</span>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.filter((p) => p < summary.enrichable).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRowsText(String(p))}
                className={cx(
                  "rounded-2lg border px-3 py-2 text-body-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                  rowsWanted === p
                    ? "border-accent-600 bg-accent-50 text-accent-700"
                    : "border-border-button-default text-text-secondary hover:bg-background-primary-hover",
                )}
              >
                {fmt(p)}
              </button>
            ))}
            <Input
              aria-label="Rows to enrich"
              type="text"
              inputMode="numeric"
              value={rowsText}
              onChange={setRowsText}
              className="w-28"
            />
          </div>
          <p className="text-body-2-regular text-text-tertiary">
            {fmt(summary.enrichable)} enrichable rows
            {summary.cached > 0 ? ` · ${fmt(summary.cached)} already enriched (free)` : ""}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RiCoinLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-headline-medium text-text-primary">
              Typically ~{fmt(estimate.typical)} credits
              <span className="text-text-secondary"> · up to {fmt(estimate.max)}</span>
            </span>
          </div>
          <span className="text-body-regular text-text-secondary">
            You have <span className="text-body-medium text-text-primary tabular-nums">{fmt(creditsAvailable)}</span> credits
          </span>
        </div>
        <ProgressBar
          aria-label="Estimated credits against balance"
          value={Math.min(estimate.typical, creditsAvailable)}
          maxValue={Math.max(1, creditsAvailable)}
          tone={short > 0 ? "warning" : "accent"}
          size="sm"
        />
        <p className="text-body-2-regular text-text-tertiary">
          The typical estimate reserves credits up front. You only pay for what we find; not-found contacts are free.
        </p>
        {short > 0 ? (
          <Banner
            tone="warning"
            title={`You need ${fmt(short)} more credits to start`}
            actions={
              <Button variant="secondary" size="small" onClick={() => toast.info("Plans and checkout arrive with billing (sprint day 5).")}>
                Buy credits
              </Button>
            }
          >
            Reduce the rows to enrich or choose fewer fields to start now.
          </Banner>
        ) : null}
      </section>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={!canStart} aria-busy={pending} className="rounded-full">
          {pending ? "Starting…" : "Start enrichment"}
        </Button>
      </div>
    </div>
  );
}
