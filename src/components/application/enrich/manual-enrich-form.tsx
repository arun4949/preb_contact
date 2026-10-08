"use client";

import { useMemo, useState, useTransition } from "react";
import { useSettingsUrl } from "@/components/application/settings/use-settings-url";
import { RiAddLine, RiBuildingLine, RiCoinLine, RiDeleteBinLine, RiLightbulbLine, RiLinkM, RiUserLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Chip } from "@/components/base/badges/chip";
import { Button } from "@/components/base/buttons/button";
import { IconButton } from "@/components/base/buttons/icon-button";
import { CheckboxCard } from "@/components/base/checkbox/checkbox-card";
import { Input } from "@/components/base/input/input";
import { useToast } from "@/components/base/toast/toast";
import { estimateCredits, type EnrichmentField } from "@/lib/credits/estimate";
import { FIELD_CARDS, FIELD_LABEL } from "@/lib/credits/fields";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { startManualEnrichment } from "@/lib/lists/actions";
import { MANUAL_MAX_CONTACTS, type ManualContact } from "@/lib/lists/manual";
import { cx } from "@/utils/cx";

const fmt = (n: number) => n.toLocaleString("en-US");

interface Row extends Required<ManualContact> {
  id: number;
}

let nextId = 1;
const emptyRow = (): Row => ({ id: nextId++, linkedin_url: "", first_name: "", last_name: "", domain: "" });

/** LinkedIn URL, or first + last + domain. Mirrors the server's enrichability rule. */
function rowIsComplete(r: Row) {
  return r.linkedin_url.trim().length > 0 || (r.first_name.trim() && r.last_name.trim() && r.domain.trim());
}
function rowIsEmpty(r: Row) {
  return !r.linkedin_url.trim() && !r.first_name.trim() && !r.last_name.trim() && !r.domain.trim();
}

export interface ManualEnrichFormProps {
  creditsAvailable: number;
}

/** The action revalidates /enrich, so the history below updates from the action response itself. */
export function ManualEnrichForm({ creditsAvailable }: ManualEnrichFormProps) {
  const toast = useToast();
  const { openSettings } = useSettingsUrl();
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<EnrichmentField[]>(["work_email"]);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [showErrors, setShowErrors] = useState(false);
  const openPlans = (shortBy: number) => openSettings("billing", { plan: true, short: shortBy });

  const complete = rows.filter(rowIsComplete);
  const invalid = rows.filter((r) => !rowIsComplete(r) && !rowIsEmpty(r));
  const estimate = useMemo(() => estimateCredits(complete.length, fields), [complete.length, fields]);
  const short = Math.max(0, estimate.typical - creditsAvailable);
  const canStart = complete.length > 0 && invalid.length === 0 && fields.length > 0 && short === 0 && !pending;

  const toggle = (key: EnrichmentField, on: boolean) => setFields((prev) => (on ? [...new Set([...prev, key])] : prev.filter((f) => f !== key)));
  const patch = (id: number, p: Partial<Row>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: number) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [emptyRow()]));
  const add = () => setRows((prev) => (prev.length < MANUAL_MAX_CONTACTS ? [...prev, emptyRow()] : prev));
  const clear = () => {
    setRows([emptyRow()]);
    setShowErrors(false);
  };

  const submit = () => {
    setShowErrors(true);
    if (!canStart) return;
    start(async () => {
      const res = await startManualEnrichment({
        contacts: complete.map(({ linkedin_url, first_name, last_name, domain }) => ({ linkedin_url, first_name, last_name, domain })),
        fields,
      });
      if (!res.ok) {
        toast.error(res.error);
        if (res.shortBy) openPlans(res.shortBy);
        return;
      }
      toast.success(complete.length === 1 ? "Enrichment started" : `Enrichment started for ${complete.length} contacts`, {
        description: "Results appear below as soon as they are in.",
      });
      clear();
    });
  };

  const ctaLabel = (() => {
    const what = fields.length === 0 ? "contact details" : fields.length === 3 ? "everything" : fields.map((f) => FIELD_LABEL[f]).join(" and ");
    const who = complete.length === 0 ? "" : complete.length === 1 ? " for 1 contact" : ` for ${complete.length} contacts`;
    return `Find ${what}${who}`;
  })();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6 rounded-3xl border border-border-button-default bg-background-primary-default p-5 md:p-6"
    >
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-headline-medium text-text-primary">What to find</h2>
          <p className="text-body-regular text-text-secondary">You only pay for what we find. Not found is free.</p>
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

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-headline-medium text-text-primary">Contacts</h2>
            <p className="text-body-regular text-text-secondary">A LinkedIn URL is enough. Otherwise give us the name and the company domain.</p>
          </div>
          <span className="text-body-2-regular text-text-tertiary tabular-nums">
            {rows.length} of {MANUAL_MAX_CONTACTS}
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {rows.map((r, i) => {
            const bad = showErrors && !rowIsComplete(r) && (!rowIsEmpty(r) || rows.length === 1);
            return (
              <li
                key={r.id}
                className={cx(
                  "flex flex-col gap-3 rounded-2xl border bg-background-secondary-default p-3 md:flex-row md:items-start",
                  bad ? "border-border-error-default" : "border-separator-border",
                )}
              >
                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-start">
                  <div className="md:w-[300px] md:shrink-0">
                    <Input
                      aria-label={`Contact ${i + 1}: LinkedIn profile URL`}
                      label={i === 0 ? "LinkedIn profile URL" : undefined}
                      placeholder="https://linkedin.com/in/jsnow"
                      leadingIcon={RiLinkM}
                      inputDir="ltr"
                      value={r.linkedin_url}
                      onChange={(v) => patch(r.id, { linkedin_url: v })}
                      isInvalid={bad}
                      autoComplete="off"
                    />
                  </div>
                  <div className={cx("flex items-center justify-center md:w-10 md:shrink-0", i === 0 ? "md:pt-8" : "md:pt-2")}>
                    <span className="rounded-full bg-background-tertiary-default px-2 py-0.5 text-caption-1-semibold uppercase text-text-tertiary">or</span>
                  </div>
                  <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      aria-label={`Contact ${i + 1}: first name`}
                      label={i === 0 ? "First name" : undefined}
                      placeholder="Jon"
                      leadingIcon={RiUserLine}
                      value={r.first_name}
                      onChange={(v) => patch(r.id, { first_name: v })}
                      isInvalid={bad}
                      autoComplete="off"
                    />
                    <Input
                      aria-label={`Contact ${i + 1}: last name`}
                      label={i === 0 ? "Last name" : undefined}
                      placeholder="Snow"
                      leadingIcon={RiUserLine}
                      value={r.last_name}
                      onChange={(v) => patch(r.id, { last_name: v })}
                      isInvalid={bad}
                      autoComplete="off"
                    />
                    <Input
                      aria-label={`Contact ${i + 1}: company domain`}
                      label={i === 0 ? "Company domain" : undefined}
                      placeholder="stark.com"
                      leadingIcon={RiBuildingLine}
                      inputDir="ltr"
                      value={r.domain}
                      onChange={(v) => patch(r.id, { domain: v })}
                      isInvalid={bad}
                      autoComplete="off"
                    />
                  </div>
                </div>
                <div className={cx("flex shrink-0 justify-end", i === 0 ? "md:pt-7" : "md:pt-1")}>
                  <IconButton
                    icon={RiDeleteBinLine}
                    aria-label={`Remove contact ${i + 1}`}
                    onClick={() => remove(r.id)}
                    className={cx(rows.length === 1 && rowIsEmpty(r) && "invisible")}
                  />
                </div>
                {bad ? (
                  <p className="text-body-2-regular text-text-error-primary md:hidden">Add a LinkedIn URL, or first name, last name and company domain.</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        {showErrors && invalid.length > 0 ? (
          <p className="hidden text-body-2-regular text-text-error-primary md:block">
            Each contact needs a LinkedIn URL, or first name, last name and company domain.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="small" leadingIcon={RiAddLine} onClick={add} disabled={rows.length >= MANUAL_MAX_CONTACTS}>
              Add contact
            </Button>
            {rows.length > 1 || !rowIsEmpty(rows[0]) ? (
              <Button type="button" variant="ghost" size="small" onClick={clear}>
                Clear all
              </Button>
            ) : null}
          </div>
          <div className="flex items-start gap-2 rounded-2xl bg-accent-50 px-3 py-2 text-body-2-regular text-accent-700 md:max-w-[360px]">
            <RiLightbulbLine className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>A LinkedIn URL gives the best match rate and adds job title, company and location.</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-separator-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RiCoinLine className="size-5 text-foreground-icon-secondary" aria-hidden />
            <span className="text-body-medium text-text-primary">
              {complete.length === 0 ? "Add a contact to see the estimate" : `Typically ~${fmt(estimate.typical)} credits`}
              {complete.length > 0 ? <span className="text-text-secondary"> · up to {fmt(estimate.max)}</span> : null}
            </span>
          </div>
          <span className="text-body-regular text-text-secondary">
            You have <span className="text-body-medium text-text-primary tabular-nums">{fmt(creditsAvailable)}</span> credits
          </span>
        </div>
        {short > 0 ? (
          <Banner
            tone="warning"
            title={`You need ${fmt(short)} more credits to start`}
            actions={
              <Button type="button" variant="secondary" size="small" onClick={() => openPlans(short)}>
                Buy credits
              </Button>
            }
          >
            Choose fewer fields or remove contacts to start now.
          </Banner>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={pending || fields.length === 0} aria-busy={pending} className="rounded-full">
            {pending ? "Starting…" : ctaLabel}
          </Button>
        </div>
      </section>
    </form>
  );
}
