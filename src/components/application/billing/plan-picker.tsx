"use client";

import { useEffect, useState, useTransition } from "react";
import { RiArrowLeftLine, RiArrowRightLine, RiMailSendLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Slider } from "@/components/base/slider/slider";
import { useToast } from "@/components/base/toast/toast";
import { useSettingsUrl } from "@/components/application/settings/use-settings-url";
import type { PlanInterval } from "@/lib/credits/plans";
import { confirmPlanSwitch, fetchPlanCatalogue, previewPlanSwitch, startCheckout, type PlanCatalogue, type PlanSwitchPreview } from "@/lib/billing/actions";
import { formatUsd, formatUsdExact, formatUsdFine } from "@/lib/credits/money";
import { CREDIT_COST } from "@/lib/fullenrich/mapping";
import { cx } from "@/utils/cx";

const fmt = (n: number) => n.toLocaleString("en-US");
/** Tick labels: 1k · 1.5k · 2k · 3k · 4k · 10k · 20k … 200k (annual: 12k … 2.4M). */
const short = (n: number) => (n >= 1_000_000 ? `${Number((n / 1_000_000).toFixed(1))}M` : n >= 1000 ? `${Number((n / 1000).toFixed(1))}k` : String(n));
const SALES_MAILTO = "mailto:sales@preb.co?subject=Preb%20volume%20pricing";
const LARGEST_MONTHLY = 200_000;

export interface PlanPickerProps {
  /** Why the picker opened, shown above the plans (e.g. a credit shortfall). */
  reason?: string;
  /** Close settings and return to whatever the user was doing. */
  onCancel: () => void;
}

/**
 * Plan picker, rendered inside Settings › Billing (plan § 6): Monthly / Annual
 * toggle, one slider across the 11 tiers with a "Contact us" stop past the
 * largest, a stats row (credits · price · per credit) and what a credit buys.
 * New subscribers continue to Stripe Checkout; existing subscribers get a
 * confirm step with the exact prorated amount from Stripe. Prices come from
 * Stripe, never computed here.
 */
export function PlanPicker({ reason, onCancel }: PlanPickerProps) {
  const [interval, setInterval] = useState<PlanInterval>("month");
  const [selected, setSelected] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<PlanCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [quote, setQuote] = useState<PlanSwitchPreview | null>(null);
  const toast = useToast();
  const { setCheckout } = useSettingsUrl();

  useEffect(() => {
    let active = true;
    fetchPlanCatalogue().then((res) => {
      if (!active) return;
      if (res.ok) {
        setCatalogue(res.data);
        const current = res.data.plans.find((p) => p.key === res.data.currentPlanKey);
        if (current) {
          setInterval(current.interval);
          // Preselect the next tier up when upgrading, else the current one.
          const same = res.data.plans.filter((p) => p.interval === current.interval);
          const idx = same.findIndex((p) => p.key === current.key);
          setSelected((same[idx + 1] ?? current).key);
        }
      } else setLoadError(res.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const monthlyPlans = (catalogue?.plans ?? []).filter((p) => p.interval === "month");
  const annualPlans = (catalogue?.plans ?? []).filter((p) => p.interval === "year");
  const plans = interval === "year" ? annualPlans : monthlyPlans;
  // Nothing picked yet: the smallest tier of the shown interval, so the price and
  // checkout are ready on open (derived, so it follows the Monthly / Annual toggle).
  const picked = selected ?? plans[0]?.key ?? null;
  const chosen = plans.find((p) => p.key === picked) ?? null;
  const currentPlan = catalogue?.plans.find((p) => p.key === catalogue.currentPlanKey) ?? null;
  const isCurrent = chosen?.key === catalogue?.currentPlanKey;
  /** Tiers line up by position (Preb 1k ↔ Preb 12k, …): the sibling plan on the other interval. */
  const siblingOf = (key: string, to: PlanInterval) => {
    const from = to === "year" ? monthlyPlans : annualPlans;
    const idx = from.findIndex((p) => p.key === key);
    return idx >= 0 ? ((to === "year" ? annualPlans : monthlyPlans)[idx] ?? null) : null;
  };

  // Slider positions: one per tier, plus a final "Contact us" stop.
  const contactIndex = plans.length;
  const sliderIndex = chosen ? plans.findIndex((p) => p.key === chosen.key) : selected === "contact" ? contactIndex : 0;
  const isContact = selected === "contact";
  const perMonthCents = chosen ? (chosen.interval === "year" ? Math.round(chosen.priceCents / 12) : chosen.priceCents) : 0;
  const monthlySibling = chosen?.interval === "year" ? siblingOf(chosen.key, "month") : null;
  const saving = chosen && monthlySibling ? Math.max(0, monthlySibling.priceCents * 12 - chosen.priceCents) : 0;
  const centsPerCredit = chosen ? chosen.priceCents / chosen.credits : 0;
  const currentIndex = catalogue?.currentPlanKey ? plans.findIndex((p) => p.key === catalogue.currentPlanKey) : -1;

  const submit = () => {
    if (!chosen) return;
    start(async () => {
      if (catalogue?.hasSubscription) {
        const res = await previewPlanSwitch(chosen.key);
        if (res.ok) setQuote(res.data);
        else toast.error(res.error);
        return;
      }
      const res = await startCheckout(chosen.key);
      // A successful call redirects the browser; only failures return.
      if (res && !res.ok) toast.error(res.error);
    });
  };

  const confirmSwitch = () => {
    if (!quote) return;
    start(async () => {
      const res = await confirmPlanSwitch(quote.planKey, quote.prorationDate);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.status === "requires_action") {
        toast.info("Your bank needs to confirm the payment", { description: "Complete it on the Stripe invoice page; the plan switches once it is paid." });
        if (res.data.url) window.location.assign(res.data.url);
        return;
      }
      // The settings host toasts and refreshes Billing + header while the webhook grant lands.
      setCheckout("switched");
    });
  };

  const ctaLabel = (() => {
    if (pending) return catalogue?.hasSubscription ? "Pricing…" : "Redirecting…";
    if (!catalogue?.canManage) return "Ask an owner to upgrade";
    if (isCurrent) return "Current plan";
    if (catalogue.hasSubscription) return "Review change";
    return chosen ? `Continue to checkout · ${formatUsd(perMonthCents)}/month` : "Continue to checkout";
  })();

  if (quote) {
    return (
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5">
          <div className="flex flex-col gap-0.5">
            <p className="text-headline-medium text-text-primary">Switch to {quote.planName}</p>
            <p className="text-body-2-regular text-text-secondary">Prorated for the rest of this period and charged to the card on file.</p>
          </div>
          <dl className="flex flex-col">
            <QuoteRow label="Charged today" value={formatUsdExact(quote.amountDueCents)} strong />
            {quote.creditedCents > 0 ? <QuoteRow label="Unused time credited to your next invoices" value={formatUsdExact(quote.creditedCents)} /> : null}
            <QuoteRow label="Credits added now" value={quote.creditsNow > 0 ? `+${fmt(quote.creditsNow)}` : "None"} last />
          </dl>
          <p className="text-body-2-regular text-text-tertiary">
            {quote.amountDueCents > 0 ? "" : "Nothing is charged today; the unused time is deducted from your next invoices. "}
            Your existing credits keep their expiry dates.
          </p>
        </section>
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" leadingIcon={RiArrowLeftLine} onClick={() => setQuote(null)} disabled={pending}>
            Back
          </Button>
          <Button onClick={confirmSwitch} disabled={pending} aria-busy={pending}>
            {pending ? "Switching…" : quote.amountDueCents > 0 ? `Pay ${formatUsdExact(quote.amountDueCents)} and switch` : "Switch plan"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {reason ? <p className="text-body-medium text-text-primary">{reason}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Billing interval"
          selectedKeys={[interval]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next === "month" || next === "year") {
              setInterval(next);
              setSelected(picked && picked !== "contact" ? (siblingOf(picked, next)?.key ?? null) : picked);
            }
          }}
        >
          <SegmentedControlItem id="month">Monthly</SegmentedControlItem>
          <SegmentedControlItem id="year" className="gap-1.5">
            Annual
            <Chip variant="caption" color="lime" className="ms-1">
              Save ~10%
            </Chip>
          </SegmentedControlItem>
        </SegmentedControl>
        {currentPlan ? (
          <span className="text-body-2-regular text-text-tertiary">
            Current plan · <span className="text-text-secondary">{currentPlan.name}</span>
          </span>
        ) : null}
      </div>

      {loadError ? (
        <p className="text-body-regular text-text-error-primary">{loadError}</p>
      ) : !catalogue ? (
        <Skeleton className="h-[340px] w-full rounded-3xl" />
      ) : (
        <section
          aria-label="Plan"
          className={cx(
            "flex flex-col gap-6 rounded-3xl border p-5 transition-colors duration-150 sm:p-6",
            isContact ? "border-border-button-default bg-background-secondary-default" : "border-accent-500 bg-background-primary-default ring-4 ring-accent-500/10",
          )}
        >
          {isContact ? (
            <div className="flex flex-col gap-1">
              <p className="text-title-2-medium text-text-primary">
                More than {short(plans[plans.length - 1]?.credits ?? LARGEST_MONTHLY)} credits a {interval === "year" ? "year" : "month"}
              </p>
              <p className="text-body-regular text-text-secondary">Volume pricing, invoicing and SSO. We reply within a business day.</p>
            </div>
          ) : chosen ? (
            <div className="relative grid grid-cols-3 gap-3">
              <Stat
                caption={chosen.interval === "year" ? "Credits / year" : "Credits / month"}
                value={fmt(chosen.credits)}
                note={chosen.interval === "year" ? `${fmt(Math.round(chosen.credits / 12))} per month` : undefined}
              />
              <Stat
                caption="Price"
                value={formatUsd(perMonthCents)}
                unit="/month"
                note={chosen.interval === "year" ? `${formatUsd(chosen.priceCents)} billed yearly${saving > 0 ? ` · save ${formatUsd(saving)}` : ""}` : undefined}
              />
              <Stat caption="Per credit" value={formatUsdFine(centsPerCredit)} accent />
              {isCurrent ? (
                <Chip variant="caption" color="blue" className="absolute top-0 end-0">
                  Current plan
                </Chip>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Slider
              aria-label="Credits per period"
              thumbLabel="Plan"
              showTooltip={false}
              minValue={0}
              maxValue={contactIndex}
              step={1}
              value={Math.max(0, sliderIndex)}
              onChange={(i) => setSelected(i === contactIndex ? "contact" : (plans[i]?.key ?? null))}
              className="px-1"
            />
            {/* Tick labels sit below the track, one per stop, centred on the stop. */}
            <div className="relative h-5 text-caption-1-medium text-text-tertiary">
              {/* The "Contact us" stop is a compact "+": with 12 stops the last tier sits 1/11 of the
                  track from the end, too close for a ">200k" label (the card spells it out). */}
              {[...plans.map((p) => short(p.credits)), "+"].map((label, i) => {
                const pct = (i / contactIndex) * 100;
                const active = i === sliderIndex;
                return (
                  <button
                    key={label}
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    onClick={() => setSelected(i === contactIndex ? "contact" : plans[i].key)}
                    className={cx(
                      "absolute top-0 cursor-pointer rounded px-1 tabular-nums transition-colors",
                      // Edge labels hug the ends so nothing is clipped by the card padding.
                      i === 0 ? "translate-x-0" : i === contactIndex ? "-translate-x-full" : "-translate-x-1/2",
                      // Phone (12 stops): neighbouring labels collide. Keep the first stop, every
                      // third stop and the selected stop; drop the rest and the end-hugging "+"
                      // (whose neighbour yields to it when "Contact us" is selected).
                      !active &&
                        i !== 0 &&
                        (i % 3 !== 0 || i === contactIndex || (i === contactIndex - 1 && sliderIndex === contactIndex)) &&
                        "hidden sm:block",
                      active ? "text-caption-1-semibold text-text-primary" : i === currentIndex ? "text-accent-600" : "hover:text-text-secondary",
                    )}
                    style={{ insetInlineStart: `${pct}%` }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {chosen ? (
            <dl className="flex flex-col">
              <PriceRow label="Work email" credits={CREDIT_COST.work_email} cents={centsPerCredit * CREDIT_COST.work_email} />
              <PriceRow label="Personal email" credits={CREDIT_COST.personal_email} cents={centsPerCredit * CREDIT_COST.personal_email} />
              <PriceRow label="Mobile number" credits={CREDIT_COST.mobile_phone} cents={centsPerCredit * CREDIT_COST.mobile_phone} />
              <div className="flex items-center justify-between gap-3 pt-2.5">
                <dt className="text-body-regular text-text-secondary">Unused credits roll over</dt>
                <dd className="text-body-medium text-text-primary">{interval === "year" ? "12 months" : "3 months"}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          {isContact ? (
            <ButtonLink href={SALES_MAILTO} trailingIcon={RiArrowRightLine}>
              Talk to sales
            </ButtonLink>
          ) : (
            <Button onClick={submit} disabled={pending || !chosen || isCurrent || !catalogue?.canManage} aria-busy={pending}>
              {ctaLabel}
            </Button>
          )}
        </div>
        <span className="flex items-center justify-end gap-1.5 text-body-2-regular text-text-tertiary">
          <RiMailSendLine className="size-4" aria-hidden />
          Need a custom plan or SSO?{" "}
          <a href={SALES_MAILTO} className="text-text-secondary underline-offset-2 hover:underline">
            Contact us
          </a>
        </span>
      </div>
    </div>
  );
}

/** One figure of the stats row: caption on top, value on a shared baseline, optional note below. */
function Stat({ caption, value, unit, note, accent }: { caption: string; value: string; unit?: string; note?: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-caption-1-medium text-text-tertiary">{caption}</span>
      <span className={cx("flex flex-wrap items-baseline gap-x-1 text-title-3-semibold tabular-nums sm:text-title-2-medium", accent ? "text-accent-600" : "text-text-primary")}>
        <span>{value}</span>
        {unit ? <span className="text-body-2-regular text-text-tertiary">{unit}</span> : null}
      </span>
      <span className={cx("text-caption-1-regular text-text-tertiary", !note && "hidden sm:block")}>{note ?? " "}</span>
    </div>
  );
}

function PriceRow({ label, credits, cents }: { label: string; credits: number; cents: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-separator-border py-2.5">
      <dt className="text-body-regular text-text-secondary">{label}</dt>
      <dd className="flex items-baseline gap-3 tabular-nums">
        <span className="text-body-2-regular text-text-tertiary">
          {credits} {credits === 1 ? "credit" : "credits"}
        </span>
        <span className="w-16 text-end text-body-medium text-text-primary">{formatUsdFine(cents)}</span>
      </dd>
    </div>
  );
}

function QuoteRow({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <div className={cx("flex items-center justify-between gap-3 py-2.5", !last && "border-b border-separator-border")}>
      <dt className="text-body-regular text-text-secondary">{label}</dt>
      <dd className={cx("tabular-nums", strong ? "text-headline-medium text-text-primary" : "text-body-medium text-text-primary")}>{value}</dd>
    </div>
  );
}
