"use client";

import { useMemo, useState, useTransition } from "react";
import { RiArrowRightLine, RiCheckboxCircleLine, RiCloseLine, RiErrorWarningLine, RiFileCopy2Line, RiMailLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button } from "@/components/base/buttons/button";
import { Select, SelectItem } from "@/components/base/select/select";
import { Switch } from "@/components/base/switch/switch";
import { useToast } from "@/components/base/toast/toast";
import { PREB_FIELDS, type ColumnMapping, type PrebField } from "@/lib/csv/automap";
import { normaliseRows } from "@/lib/csv/normalize";
import type { ParsedSheet } from "@/lib/csv/parse";
import { parseList, type ParseSummary } from "@/lib/lists/actions";
import { cx } from "@/utils/cx";

export interface StepMapProps {
  listId: string;
  sheet: ParsedSheet;
  mapping: ColumnMapping;
  hasHeader: boolean;
  onMappingChange: (m: ColumnMapping) => void;
  onHeaderChange: (next: boolean) => void;
  onParsed: (summary: ParseSummary) => void;
}

const NONE = "__none__";
const fmt = (n: number) => n.toLocaleString("en-US");

/** Step 2 (Figma 1015:41): one row per Preb field with a column select + example value; live summary. */
export function StepMap({ listId, sheet, mapping, hasHeader, onMappingChange, onHeaderChange, onParsed }: StepMapProps) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [showMissing, setShowMissing] = useState(false);

  const { summary, rows } = useMemo(() => normaliseRows(sheet.rows, sheet.headers, mapping), [sheet, mapping]);
  const missingRows = useMemo(() => rows.filter((r) => r.skipReason === "missing_fields").slice(0, 5), [rows]);
  const example = (field: PrebField) => {
    const idx = mapping[field];
    if (idx == null) return null;
    const v = sheet.rows.find((r) => r[idx])?.[idx];
    return v || null;
  };
  const usedBy = (idx: number) => (Object.keys(mapping) as PrebField[]).find((k) => mapping[k] === idx);

  const setField = (field: PrebField, key: string | null) => {
    const next: ColumnMapping = { ...mapping };
    const idx = key == null || key === NONE ? null : Number(key);
    if (idx != null) {
      // A column maps to one field at a time.
      for (const k of Object.keys(next) as PrebField[]) if (next[k] === idx) next[k] = null;
    }
    next[field] = idx;
    onMappingChange(next);
  };

  const submit = () =>
    start(async () => {
      const res = await parseList(listId, mapping, hasHeader);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onParsed(res.data);
    });

  return (
    <div className="flex flex-col gap-6">
      <Banner tone="info">
        Map <strong className="text-text-primary">names and company</strong> (name or domain), <strong className="text-text-primary">or LinkedIn profile URLs</strong>,{" "}
        <strong className="text-text-primary">or emails</strong>. Unmapped columns are kept as extra columns in the export.
      </Banner>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-hidden rounded-3xl border border-border-button-default bg-background-primary-default">
          <div className="grid grid-cols-[minmax(0,1fr)_24px_140px] items-center gap-3 border-b border-border-table bg-background-secondary-default px-5 py-3 text-caption-1-semibold text-text-secondary">
            <span>Spreadsheet column</span>
            <span />
            <span>Preb field</span>
          </div>
          <ul className="divide-y divide-border-table">
            {PREB_FIELDS.map((f) => {
              const idx = mapping[f.key];
              const ex = example(f.key);
              return (
                <li key={f.key} className="grid grid-cols-[minmax(0,1fr)_24px_140px] items-start gap-3 px-5 py-4">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center gap-1">
                      <Select
                        aria-label={`Column for ${f.label}`}
                        selectedKey={idx == null ? NONE : String(idx)}
                        onSelectionChange={(k) => setField(f.key, k == null ? null : String(k))}
                        className="min-w-0 flex-1"
                        triggerClassName={idx == null ? "text-text-tertiary" : undefined}
                        popoverClassName="w-[320px]"
                      >
                        <SelectItem id={NONE} textValue="Not mapped">
                          <span className="text-text-tertiary">Not mapped</span>
                        </SelectItem>
                        {sheet.headers.map((h, i) => {
                          const taken = usedBy(i);
                          return (
                            <SelectItem key={i} id={String(i)} textValue={h}>
                              <span className="truncate">{h}</span>
                              {taken && taken !== f.key ? (
                                <span className="ms-auto text-caption-1-regular text-text-tertiary">{PREB_FIELDS.find((p) => p.key === taken)?.label}</span>
                              ) : null}
                            </SelectItem>
                          );
                        })}
                      </Select>
                      {idx != null ? (
                        <button
                          type="button"
                          aria-label={`Clear ${f.label}`}
                          onClick={() => setField(f.key, null)}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground-icon-tertiary outline-none hover:bg-background-secondary-hover hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                        >
                          <RiCloseLine className="size-4" aria-hidden />
                        </button>
                      ) : (
                        <span aria-hidden className="size-8 shrink-0" />
                      )}
                    </div>
                    <p className="truncate text-body-2-regular text-text-tertiary">
                      {ex ? (
                        <>
                          e.g. <span className="text-text-secondary">{ex}</span>
                        </>
                      ) : (
                        f.hint || " "
                      )}
                    </p>
                  </div>
                  <RiArrowRightLine className="mt-2.5 size-4 text-foreground-icon-tertiary rtl:rotate-180" aria-hidden />
                  <span className={cx("mt-2 text-body-medium", idx == null ? "text-text-tertiary" : "text-text-primary")}>{f.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="flex h-fit flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 lg:sticky lg:top-24">
          <h2 className="text-headline-medium text-text-primary">Rows</h2>
          <ul className="flex flex-col gap-3">
            <SummaryRow icon={RiCheckboxCircleLine} tone="success" label={`${fmt(summary.enrichable)} of ${fmt(summary.total)} rows enrichable`} />
            <SummaryRow
              icon={RiErrorWarningLine}
              tone={summary.missingFields > 0 ? "warning" : "muted"}
              label={`${fmt(summary.missingFields)} ${summary.missingFields === 1 ? "row" : "rows"} missing required fields`}
              action={
                summary.missingFields > 0 ? (
                  <button type="button" className="text-body-2-medium text-accent-600 underline-offset-2 hover:underline" onClick={() => setShowMissing((v) => !v)}>
                    {showMissing ? "hide" : "view"}
                  </button>
                ) : null
              }
            />
            <SummaryRow icon={RiFileCopy2Line} tone="muted" label={`${fmt(summary.duplicates)} ${summary.duplicates === 1 ? "duplicate" : "duplicates"} removed`} />
            {summary.emailOnly > 0 ? (
              <SummaryRow icon={RiMailLine} tone="muted" label={`${fmt(summary.emailOnly)} email-only ${summary.emailOnly === 1 ? "row" : "rows"} — can be identified in the next step`} />
            ) : null}
          </ul>
          {showMissing && missingRows.length > 0 ? (
            <ul className="flex flex-col gap-1 rounded-xl bg-background-secondary-default p-3 text-body-2-regular text-text-secondary">
              {missingRows.map((r) => (
                <li key={r.rowIndex} className="truncate">
                  Row {r.rowIndex + (hasHeader ? 2 : 1)}: {Object.values(r.raw).slice(0, 3).join(" · ") || "empty"}
                </li>
              ))}
              {summary.missingFields > missingRows.length ? <li>…and {fmt(summary.missingFields - missingRows.length)} more</li> : null}
            </ul>
          ) : null}
          <Switch isSelected={hasHeader} onChange={onHeaderChange} size="sm">
            First row contains headers
          </Switch>
          <Button onClick={submit} disabled={pending || (summary.enrichable === 0 && summary.emailOnly === 0)} aria-busy={pending} className="w-full">
            {pending ? "Preparing rows…" : "Next step"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  tone,
  label,
  action,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  tone: "success" | "warning" | "muted";
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <Icon
        className={cx(
          "size-4 shrink-0",
          tone === "success" && "text-notification-success-foreground",
          tone === "warning" && "text-status-orange-text",
          tone === "muted" && "text-foreground-icon-tertiary",
        )}
        aria-hidden
      />
      <span className="flex-1 text-body-regular text-text-secondary">{label}</span>
      {action}
    </li>
  );
}
