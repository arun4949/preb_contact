"use client";

import type { ComponentType, ReactNode } from "react";
import { RiCheckDoubleLine, RiCheckLine, RiInformationLine, RiQuestionFill, RiShieldCheckFill, RiSignalWifi1Fill, RiSignalWifi2Fill, RiSignalWifi3Fill, RiUserUnfollowFill } from "@remixicon/react";
import { Focusable } from "react-aria-components";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import type { EnrichedPhone } from "@/lib/fullenrich/types";
import type { EmailCandidate } from "@/lib/lists/candidates";
import { CONNECT_RATE_META, EMAIL_LEVEL_META, LINE_STATUS_LABEL, LINE_TYPE_LABEL, OWNERSHIP_META, type EmailLevel } from "@/lib/lists/email-levels";
import { cx } from "@/utils/cx";

/**
 * The small glyphs after an email or a phone number in the contacts table,
 * each with a tooltip that explains the verification result. Hover or focus
 * opens the tooltip (react-aria); the glyphs are the only focusable parts of
 * a cell besides the copy button and the links.
 */

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

const EMAIL_ICON: Record<EmailLevel, Icon> = { valid: RiShieldCheckFill, probable: RiCheckLine, catch_all: RiQuestionFill };
const CONNECT_ICON: Record<NonNullable<EnrichedPhone["connect_rate"]>, Icon> = { HIGHEST: RiSignalWifi3Fill, HIGH: RiSignalWifi2Fill, MEDIUM: RiSignalWifi1Fill };

/** Tooltip body: a headline, an explanation and an optional emphasised footer line. */
export function MarkerTip({ title, children, footer }: { title: string; children?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-0.5">
      <p className="text-body-medium text-text-primary">{title}</p>
      {children ? <div className="text-body-2-regular text-text-secondary">{children}</div> : null}
      {footer ? <p className="text-body-2-medium text-text-primary">{footer}</p> : null}
    </div>
  );
}

function Marker({ label, className, children, tip }: { label: string; className?: string; children: ReactNode; tip: ReactNode }) {
  return (
    <TooltipTrigger delay={150}>
      <Focusable>
        <span
          role="img"
          tabIndex={0}
          aria-label={label}
          className={cx(
            "inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-md outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
            className,
          )}
        >
          {children}
        </span>
      </Focusable>
      <Tooltip size="md" className="max-w-[300px]" placement="top">
        {tip}
      </Tooltip>
    </TooltipTrigger>
  );
}

export function EmailMarker({ level }: { level: EmailLevel }) {
  const meta = EMAIL_LEVEL_META[level];
  const Icon = EMAIL_ICON[level];
  return (
    <Marker label={meta.label} tip={<MarkerTip title={meta.title} footer={meta.bounce}>{meta.description}</MarkerTip>}>
      <Icon className={cx("size-4", meta.text)} aria-hidden />
    </Marker>
  );
}

function PhoneDetails({ meta }: { meta: EnrichedPhone }) {
  const lines: string[] = [];
  if (meta.line_type) lines.push(`Line type: ${LINE_TYPE_LABEL[meta.line_type]}`);
  if (meta.line_status) lines.push(`Line status: ${LINE_STATUS_LABEL[meta.line_status]}`);
  if (meta.region) lines.push(`Region: ${meta.region}`);
  if (lines.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5 border-t border-separator-border pt-1.5 text-caption-1-regular text-text-tertiary">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

/** Ownership verdict (US and Canada only). Hidden when the provider gave none. */
export function PhoneOwnershipMarker({ meta }: { meta: EnrichedPhone | null | undefined }) {
  const match = meta?.ownership_match;
  if (!meta || !match) return null;
  const m = OWNERSHIP_META[match];
  const confidence = typeof meta.ownership_match_confidence === "number" ? meta.ownership_match_confidence : undefined;
  const Icon = match === "CONFIRMED" ? RiCheckDoubleLine : RiUserUnfollowFill;
  return (
    <Marker label={m.title} tip={<MarkerTip title={m.title} footer={confidence != null ? `Confidence: ${confidence}%` : undefined}>{m.description()}<PhoneDetails meta={meta} /></MarkerTip>}>
      <Icon className={cx("size-4", m.text)} aria-hidden />
    </Marker>
  );
}

/** Connect rate bucket (active US and Canada mobiles). Hidden when the provider gave none. */
export function PhoneConnectMarker({ meta }: { meta: EnrichedPhone | null | undefined }) {
  const rate = meta?.connect_rate;
  if (!meta || !rate) return null;
  const m = CONNECT_RATE_META[rate];
  const Icon = CONNECT_ICON[rate];
  return (
    <Marker label={m.title} tip={<MarkerTip title={m.title}>{m.description}<PhoneDetails meta={meta} /></MarkerTip>}>
      <Icon className={cx("size-4", m.text)} aria-hidden />
    </Marker>
  );
}

/** Line details for a phone that has neither an ownership verdict nor a connect rate. */
export function PhoneInfoMarker({ meta }: { meta: EnrichedPhone | null | undefined }) {
  if (!meta || meta.ownership_match || meta.connect_rate) return null;
  const type = meta.line_type ? LINE_TYPE_LABEL[meta.line_type] : null;
  if (!type && !meta.line_status && !meta.region) return null;
  return (
    <Marker label="Phone details" tip={<MarkerTip title={type ? `${type} number` : "Phone number"}>Ownership checks and connect rates are only available for mobile numbers in the US and Canada.<PhoneDetails meta={meta} /></MarkerTip>}>
      <RiInformationLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
    </Marker>
  );
}

/** Counter after a cell when the enrichment returned more than one candidate; the tooltip lists them all. */
export function CandidateBadge({ title, children, count }: { title: string; count: number; children: ReactNode }) {
  return (
    <TooltipTrigger delay={150}>
      <Focusable>
        <span
          role="img"
          tabIndex={0}
          aria-label={title}
          className="inline-flex h-5 min-w-5 shrink-0 cursor-help items-center justify-center rounded-full bg-background-tertiary-default px-1.5 text-caption-1-semibold tracking-normal text-text-secondary outline-none transition-colors hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          {count}
        </span>
      </Focusable>
      <Tooltip size="md" className="max-w-[360px]" placement="top">
        <MarkerTip title={title}>
          <ul className="flex flex-col gap-1">{children}</ul>
          <p className="mt-1.5 text-caption-1-regular text-text-tertiary">The most likely one is shown in the table.</p>
        </MarkerTip>
      </Tooltip>
    </TooltipTrigger>
  );
}

export function EmailCandidateList({ candidates }: { candidates: EmailCandidate[] }) {
  return (
    <>
      {candidates.map((c) => {
        const meta = EMAIL_LEVEL_META[c.level];
        const Icon = EMAIL_ICON[c.level];
        return (
          <li key={c.email} className="flex items-center gap-1.5">
            <Icon className={cx("size-3.5 shrink-0", meta.text)} aria-hidden />
            <span className="truncate text-text-primary" dir="ltr">
              {c.email}
            </span>
            <span className="ms-auto shrink-0 text-caption-1-regular text-text-tertiary">{meta.label}</span>
          </li>
        );
      })}
    </>
  );
}

export function PhoneCandidateList({ candidates }: { candidates: EnrichedPhone[] }) {
  return (
    <>
      {candidates.map((p) => (
        <li key={p.number} className="flex items-center gap-1.5">
          <span className="tabular-nums text-text-primary" dir="ltr">
            {p.number}
          </span>
          <span className="ms-auto shrink-0 text-caption-1-regular text-text-tertiary">
            {[p.line_type ? LINE_TYPE_LABEL[p.line_type] : null, p.connect_rate ? `${CONNECT_RATE_META[p.connect_rate].label} connect rate` : null].filter(Boolean).join(", ")}
          </span>
        </li>
      ))}
    </>
  );
}
