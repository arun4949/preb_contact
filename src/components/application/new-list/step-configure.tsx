"use client";

import { useMemo, useState, useTransition } from "react";
import { useSettingsUrl } from "@/components/application/settings/use-settings-url";
import { RiCoinLine, RiUserSearchLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { CheckboxCard } from "@/components/base/checkbox/checkbox-card";
import { Chip } from "@/components/base/badges/chip";
import { Input } from "@/components/base/input/input";
import { ProgressBar } from "@/components/base/progress-bar/progress-bar";
import { useToast } from "@/components/base/toast/toast";
import { estimateCredits, type EnrichmentField } from "@/lib/credits/estimate";
import { FIELD_CARDS } from "@/lib/credits/fields";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { startList, type ParseSummary } from "@/lib/lists/actions";
import { cx } from "@/utils/cx";

const fmt = (n: number) => n.toLocaleString("en-US");
const PRESETS = [500, 1000, 2500, 5000];


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
  const { openSettings } = useSettingsUrl();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<EnrichmentField[]>(summary.enrichable > 0 ? ["work_email"] : []);
  const [name, setName] = useState(defaultName);
  // Reverse lookup is opt-in; a list made only of emails has nothing else to do, so it starts on.
  const [reverse, setReverse] = useState(summary.enrichable === 0 && summary.emailOnly > 0);
  const [rowsText, setRowsText] = useState(String(summary.enrichable + (summary.enrichable === 0 ? summary.emailOnly : 0)));

  const reverseRowsAll = reverse ? summary.emailOnly : 0;
  const totalRows = summary.enrichable + reverseRowsAll;
  const billable = Math.max(0, summary.enrichable - summary.cached);
  const rowsWanted = Math.max(0, Math.min(Number(rowsText.replace(/[^\d]/g, "")) || 0, totalRows));
  // The engine sends enrich rows first, then email-only rows; the row limit spans both.
  const enrichRows = Math.min(rowsWanted, summary.enrichable);
  const reverseRows = Math.min(reverseRowsAll, rowsWanted - enrichRows);
  const rows = Math.min(enrichRows, billable);
  const estimate = useMemo(() => estimateCredits(rows, fields, reverseRows), [rows, fields, reverseRows]);
  const short = Math.max(0, estimate.typical - creditsAvailable);
  const freeRows = summary.cached + summary.cachedReverse;
  // Every row was served from the cache: nothing to buy, the list completes on start.
  const allCached = totalRows === 0 && freeRows > 0;
  const hasWork = allCached || (summary.enrichable > 0 ? fields.length > 0 : reverse);
  const canStart = hasWork && name.trim().length > 0 && (allCached || rowsWanted > 0) && short === 0 && !pending;

  const toggle = (key: EnrichmentField, on: boolean) => setFields((prev) => (on ? [...new Set([...prev, key])] : prev.filter((f) => f !== key)));

  const toggleReverse = (on: boolean) => {
    // Keep "all rows" selected when the user had not narrowed the count.
    const nextTotal = summary.enrichable + (on ? summary.emailOnly : 0);
    if (rowsWanted === totalRows) setRowsText(String(nextTotal));
    setReverse(on);
  };

  const submit = () =>
    start(async () => {
      onStarting();
      const res = await startList(listId, {
        name,
        fields,
        rowLimit: rowsWanted < totalRows ? rowsWanted : null,
        reverseLookup: reverse,
      });
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

      {summary.emailOnly > 0 || summary.cachedReverse > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-headline-medium text-text-primary">Email-only rows</h2>
            <p className="text-body-regular text-text-secondary">
              {summary.emailOnly > 0
                ? `${fmt(summary.emailOnly)} ${summary.emailOnly === 1 ? "row has" : "rows have"} an email address but no name or company. We can identify the person behind each one.`
                : null}
              {summary.cachedReverse > 0
                ? `${summary.emailOnly > 0 ? " " : ""}${fmt(summary.cachedReverse)} email-only ${summary.cachedReverse === 1 ? "row was" : "rows were"} already identified in this workspace and ${summary.cachedReverse === 1 ? "is" : "are"} included for free.`
                : null}
            </p>
          </div>
          {summary.emailOnly > 0 ? (
            <CheckboxCard
              isSelected={reverse}
              onChange={toggleReverse}
              title={
                <span className="flex items-center gap-2">
                  <RiUserSearchLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                  Identify email-only rows
                  <Chip variant="caption" color="soft">
                    {CREDIT_COST.reverse} credit
                  </Chip>
                </span>
              }
              description="Reverse lookup adds name, job title, company, location and LinkedIn. Charged only when a person is identified."
              className={cx("items-start", reverse && "border-accent-600")}
            />
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Input label="Name this list" placeholder="e.g. Sales Directors in NYC" value={name} onChange={setName} maxLength={120} isRequired />
        <div className="flex flex-col gap-1.5">
          <span className="text-body-medium text-text-primary">Rows to enrich</span>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.filter((p) => p < totalRows).map((p) => (
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
            <Input aria-label="Rows to enrich" type="text" inputMode="numeric" value={rowsText} onChange={setRowsText} className="w-28" />
          </div>
          <p className="text-body-2-regular text-text-tertiary">
            {fmt(summary.enrichable)} enrichable rows
            {summary.cached > 0 ? ` · ${fmt(summary.cached)} already enriched (free)` : ""}
            {summary.cachedReverse > 0 ? ` · ${fmt(summary.cachedReverse)} already identified (free)` : ""}
            {reverse ? ` · ${fmt(summary.emailOnly)} email-only (reverse lookup)` : ""}
            {summary.suppressed > 0 ? ` · ${fmt(summary.suppressed)} skipped because the person asked not to be contacted` : ""}
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
              <Button variant="secondary" size="small" onClick={() => openSettings("billing", { plan: true, short })}>
                Buy credits
              </Button>
            }
          >
            Reduce the rows to enrich, choose fewer fields
            {summary.emailOnly > 0 ? " or skip the reverse lookup" : ""} to start now. After checkout you will upload the file again.
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
