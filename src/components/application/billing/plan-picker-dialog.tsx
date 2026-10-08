"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiArrowLeftLine, RiArrowRightLine, RiCalendarLine, RiCoinLine, RiMailLine, RiMailSendLine, RiSmartphoneLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { Chip } from "@/components/base/badges/chip";
import { Dialog } from "@/components/base/dialog/dialog";
import { SegmentedControl, SegmentedControlItem } from "@/components/base/segmented-control/segmented-control";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { Slider } from "@/components/base/slider/slider";
import { useToast } from "@/components/base/toast/toast";
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

export interface PlanPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Why the picker opened — shown under the title (e.g. the wizard's shortfall). */
  reason?: string;
}

/**
 * Plan picker (plan § 6 · Settings › Billing): Monthly / Annual toggle, one
 * slider across the 11 tiers with the chosen credits, price and per-credit
 * price in the headline and a "Contact us" stop past the largest tier. New subscribers continue to Stripe Checkout; existing subscribers
 * get a confirm step with the exact prorated amount from Stripe, charged to
 * the saved payment method on confirm. Prices come from Stripe, never computed here.
 */
export function PlanPickerDialog({ isOpen, onClose, reason }: PlanPickerDialogProps) {
  const [interval, setInterval] = useState<PlanInterval>("month");
  const [selected, setSelected] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<PlanCatalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [quote, setQuote] = useState<PlanSwitchPreview | null>(null);
  const toast = useToast();
  const router = useRouter();

  // Reset the error when the dialog (re)opens — derived during render, no effect.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen) {
      setLoadError(null);
      setQuote(null);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const monthlyPlans = (catalogue?.plans ?? []).filter((p) => p.interval === "month");
  const annualPlans = (catalogue?.plans ?? []).filter((p) => p.interval === "year");
  const plans = interval === "year" ? annualPlans : monthlyPlans;
  // Nothing picked yet: default to the smallest tier of the shown interval so the price and
  // checkout are ready on open (derived, so it follows the Monthly / Annual toggle).
  const picked = selected ?? plans[0]?.key ?? null;
  const chosen = plans.find((p) => p.key === picked) ?? null;
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

  const continueLabel = !catalogue?.canManage
    ? "Ask an owner to upgrade"
    : catalogue.hasSubscription
      ? "Switch plan"
      : "Continue to checkout";

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
      onClose();
      // The settings host toasts and refreshes Billing + header while the webhook grant lands.
      router.replace("/lists?settings=billing&checkout=switched", { scroll: false });
    });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={quote ? "Confirm plan change" : "Choose a plan"}
      description={quote ? undefined : (reason ?? "Credits refill every billing period. Monthly credits last 3 months, annual credits 12 months.")}
      size="lg"
      footer={
        quote ? (
          <>
            <Button variant="secondary" leadingIcon={RiArrowLeftLine} onClick={() => setQuote(null)} className="me-auto" disabled={pending}>
              Back
            </Button>
            <Button onClick={confirmSwitch} disabled={pending} aria-busy={pending}>
              {pending ? "Switching…" : quote.amountDueCents > 0 ? `Pay ${formatUsdExact(quote.amountDueCents)} and switch` : "Switch plan"}
            </Button>
          </>
        ) : (
        <>
          <span className="me-auto flex items-center gap-1.5 text-body-2-regular text-text-tertiary">
            <RiMailSendLine className="size-4" aria-hidden />
            Need a custom plan or SSO? <a href={SALES_MAILTO} className="text-text-secondary underline-offset-2 hover:underline">Contact us</a>
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {isContact ? (
            <ButtonLink href={SALES_MAILTO} trailingIcon={RiArrowRightLine}>
              Talk to us
            </ButtonLink>
          ) : (
            <Button onClick={submit} disabled={pending || !chosen || isCurrent || !catalogue?.canManage} aria-busy={pending}>
              {pending ? (catalogue?.hasSubscription ? "Pricing…" : "Redirecting…") : isCurrent ? "Current plan" : chosen ? `${continueLabel} · ${short(chosen.credits)} credits` : continueLabel}
            </Button>
          )}
        </>
        )
      }
    >
      {quote ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-background-secondary-default p-4">
          <p className="text-headline-medium text-text-primary">Switch to {quote.planName}</p>
          <dl className="flex flex-col gap-2 text-body-regular">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-secondary">Charged today</dt>
              <dd className="text-body-medium text-text-primary tabular-nums">{formatUsdExact(quote.amountDueCents)}</dd>
            </div>
            {quote.creditedCents > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-secondary">Unused time credited to your next invoices</dt>
                <dd className="text-body-medium text-text-primary tabular-nums">{formatUsdExact(quote.creditedCents)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-text-secondary">Credits added now</dt>
              <dd className="text-body-medium text-text-primary tabular-nums">{quote.creditsNow > 0 ? `+${fmt(quote.creditsNow)}` : "—"}</dd>
            </div>
          </dl>
          <p className="text-body-2-regular text-text-tertiary">
            {quote.amountDueCents > 0
              ? "Charged to the card on file, prorated for the rest of this period."
              : "Nothing is charged today; the unused time is deducted from your next invoices."}{" "}
            Your existing credits keep their expiry dates.
          </p>
        </div>
      ) : (
      <div className="flex flex-col gap-4">
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
        </div>

        {loadError ? (
          <p className="text-body-regular text-text-error-primary">{loadError}</p>
        ) : !catalogue ? (
          <Skeleton className="h-[168px] w-full rounded-2xl" />
        ) : (
          <section
            aria-label="Plan"
            className={cx(
              "flex flex-col gap-5 rounded-2xl border p-5 transition-colors duration-150",
              isContact ? "border-border-button-default bg-background-secondary-default" : "border-accent-500 bg-background-primary-default ring-4 ring-accent-500/10",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isContact ? (
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-title-3-semibold text-text-primary">More than {short(plans[plans.length - 1]?.credits ?? LARGEST_MONTHLY)} credits</p>
                  <p className="text-body-regular text-text-secondary">Volume pricing, invoicing and SSO — we reply within a business day.</p>
                </div>
              ) : chosen ? (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2 text-title-3-semibold text-text-primary tabular-nums">
                    <RiCoinLine className="size-5 text-accent-600" aria-hidden />
                    {fmt(chosen.credits)} credits
                    <span className="text-body-regular text-text-secondary">/ {chosen.interval}</span>
                  </span>
                  <span aria-hidden className="hidden h-5 w-px bg-separator-border sm:block" />
                  <span className="text-title-3-semibold text-text-primary tabular-nums">
                    {formatUsd(perMonthCents)} <span className="text-body-regular text-text-secondary">/month</span>
                  </span>
                  <span aria-hidden className="hidden h-5 w-px bg-separator-border sm:block" />
                  <span className="text-title-3-semibold text-accent-600 tabular-nums">
                    {formatUsdFine(centsPerCredit)} <span className="text-body-regular text-text-secondary">/ credit</span>
                  </span>
                  {chosen.interval === "year" ? (
                    <span className="text-body-2-regular text-text-tertiary">
                      {formatUsd(chosen.priceCents)} billed yearly{saving > 0 ? ` · save ${formatUsd(saving)}` : ""}
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <Chip variant="caption" color="blue">
                      Current plan
                    </Chip>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              {/* Tick labels sit above the track, one per stop, centred on the stop. */}
              <div className="relative h-5 text-caption-1-medium text-text-tertiary">
                {/* The "Contact us" stop is a compact "+": with 12 stops the last tier sits 1/11 of the
                    track from the end, too close for a ">200k" label (the headline spells it out). */}
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
                        // Edge labels hug the ends so nothing is clipped by the dialog padding.
                        i === 0 ? "translate-x-0" : i === contactIndex ? "-translate-x-full" : "-translate-x-1/2",
                        // Phone (12 stops): neighbouring labels collide. Keep the first stop, every
                        // third stop and the selected stop; drop the rest and the end-hugging "+"
                        // (whose neighbour yields to it when "Contact us" is selected).
                        !active &&
                          i !== 0 &&
                          (i % 3 !== 0 || i === contactIndex || (i === contactIndex - 1 && sliderIndex === contactIndex)) &&
                          "hidden sm:block",
                        active ? "text-text-primary" : i === currentIndex ? "text-accent-600" : "hover:text-text-secondary",
                      )}
                      style={{ insetInlineStart: `${pct}%` }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
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
            </div>

            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-body-2-regular text-text-secondary">
              <li className="flex items-center gap-1.5">
                <RiCalendarLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
                {interval === "year" ? "12 months" : "3 months"} credit rollover
              </li>
              {chosen ? (
                <>
                  <li className="flex items-center gap-1.5">
                    <RiMailLine className="size-4 text-foreground-icon-tertiary" aria-hidden />1 work email = {CREDIT_COST.work_email} credits ({formatUsdFine(centsPerCredit * CREDIT_COST.work_email)})
                  </li>
                  <li className="flex items-center gap-1.5">
                    <RiMailSendLine className="size-4 text-foreground-icon-tertiary" aria-hidden />1 personal email = {CREDIT_COST.personal_email} credits ({formatUsdFine(centsPerCredit * CREDIT_COST.personal_email)})
                  </li>
                  <li className="flex items-center gap-1.5">
                    <RiSmartphoneLine className="size-4 text-foreground-icon-tertiary" aria-hidden />1 mobile = {CREDIT_COST.mobile_phone} credits ({formatUsdFine(centsPerCredit * CREDIT_COST.mobile_phone)})
                  </li>
                </>
              ) : null}
            </ul>
          </section>
        )}
      </div>
      )}
    </Dialog>
  );
}
