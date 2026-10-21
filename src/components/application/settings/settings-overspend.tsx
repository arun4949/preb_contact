"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RiBankCardLine } from "@remixicon/react";
import { Banner } from "@/components/base/banner/banner";
import { Button, ButtonLink } from "@/components/base/buttons/button";
import { ConfirmDialog } from "@/components/base/dialog/dialog";
import { Select, SelectItem } from "@/components/base/select/select";
import { Switch } from "@/components/base/switch/switch";
import { useToast } from "@/components/base/toast/toast";
import { retryOverspendPaymentAction, setOverspendEnabled, setOverspendLimit } from "@/lib/billing/actions";
import type { OverspendOverview } from "@/lib/billing/queries";
import { formatUsdExact } from "@/lib/credits/money";
import { limitPresets } from "@/lib/credits/overspend";
import { cx } from "@/utils/cx";
import { SettingsCard, SettingsRow, SettingsSectionLabel } from "./settings-rows";

const fmt = (n: number) => n.toLocaleString("en-US");

export interface SettingsOverspendProps {
  data: OverspendOverview;
  /** Reload the billing page after a change that affects other sections (block lifted, limit saved). */
  onChanged: () => void;
  onSaved?: () => void;
  onOpenPortal: () => void;
  portalPending: boolean;
  /** Scroll into view and highlight briefly (deep link `&overspend=1`). */
  focus?: boolean;
}

function cardLabel(card: OverspendOverview["card"]): string {
  if (!card) return "No card on file";
  const brand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);
  return card.last4 ? `${brand} ending ${card.last4}` : brand;
}

/**
 * Settings › Billing › Overspend: the workspace opt-in that lets lists keep
 * enriching when the balance is empty. Enabling goes through a confirmation
 * dialog (it authorises automatic card charges); the limit and the switch
 * save optimistically like the profile switches.
 */
export function SettingsOverspend({ data, onChanged, onSaved, onOpenPortal, portalPending, focus = false }: SettingsOverspendProps) {
  const toast = useToast();
  const router = useRouter();
  const [enabled, setEnabled] = useState(data.enabled);
  const [limit, setLimit] = useState<number | null>(data.limit);
  const [confirming, setConfirming] = useState(false);
  const [switchPending, startSwitch] = useTransition();
  const [limitPending, startLimit] = useTransition();
  const [retryPending, startRetry] = useTransition();
  const [highlight, setHighlight] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // A reload (onChanged) brings fresh data: adopt it without an effect (derived state pattern).
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setEnabled(data.enabled);
    setLimit(data.limit);
  }

  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlight(true);
    }, 150);
    const off = setTimeout(() => setHighlight(false), 1_900);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
  }, [focus]);

  const eligible = data.ineligibleReason === null;
  const manageable = data.canManage && eligible && Boolean(data.card);

  const description = (() => {
    if (data.ineligibleReason === "internal") return "Not available for this workspace.";
    if (data.ineligibleReason === "trial" || data.ineligibleReason === "no_subscription") return "Available with a plan. Credits beyond your balance are charged at your plan's price per credit.";
    if (!data.card) return "Add a payment method under Manage billing first.";
    return `Credits beyond your balance are charged to your card at ${data.rate} per credit, one invoice per list when it finishes.`;
  })();

  const onToggle = (next: boolean) => {
    if (next) {
      setConfirming(true);
      return;
    }
    setEnabled(false);
    startSwitch(async () => {
      const res = await setOverspendEnabled(false);
      if (res.ok) {
        onSaved?.();
        onChanged();
        router.refresh();
      } else {
        setEnabled(true);
        toast.error(res.error);
      }
    });
  };

  const confirmEnable = () =>
    startSwitch(async () => {
      const res = await setOverspendEnabled(true);
      if (res.ok) {
        setEnabled(true);
        setConfirming(false);
        toast.success("Overspend is on", { description: "Lists keep running when credits run out. Extra credits are invoiced when a list finishes." });
        onChanged();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  const changeLimit = (next: number | null) => {
    if (next === limit) return;
    const previous = limit;
    setLimit(next);
    startLimit(async () => {
      const res = await setOverspendLimit(next);
      if (res.ok) {
        onSaved?.();
        onChanged();
      } else {
        setLimit(previous);
        toast.error(res.error);
      }
    });
  };

  const retry = () =>
    startRetry(async () => {
      const res = await retryOverspendPaymentAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.status === "paid") {
        toast.success("Payment received", { description: "Paused lists continue within a minute." });
        onChanged();
        router.refresh();
      } else if (res.data.url) {
        window.open(res.data.url, "_blank", "noopener");
        toast.info("Your bank asks for a confirmation", { description: "Complete it on the invoice page that just opened." });
      }
    });

  const presets = limitPresets(data.plan, limit);
  const limitKey = limit == null ? "none" : String(limit);
  const unpaid = data.unpaid;

  return (
    <div ref={sectionRef} className="flex w-full scroll-mt-4 flex-col gap-2">
      <SettingsSectionLabel>Overspend</SettingsSectionLabel>
      {unpaid && data.blockedReason ? (
        <Banner
          tone="error"
          title={unpaid.actionRequired ? `Your overspend payment of ${formatUsdExact(unpaid.amountCents)} needs your confirmation` : `Your overspend payment of ${formatUsdExact(unpaid.amountCents)} failed`}
          actions={
            data.canManage ? (
              <>
                {unpaid.actionRequired && unpaid.hostedUrl ? (
                  <ButtonLink href={unpaid.hostedUrl} target="_blank" rel="noopener noreferrer" size="small">
                    Complete payment
                  </ButtonLink>
                ) : (
                  <Button size="small" onClick={retry} disabled={retryPending} aria-busy={retryPending}>
                    {retryPending ? "Retrying…" : "Retry payment"}
                  </Button>
                )}
                <Button variant="secondary" size="small" onClick={onOpenPortal} disabled={portalPending}>
                  Update card
                </Button>
              </>
            ) : null
          }
        >
          {fmt(unpaid.credits)} credits beyond your balance are still unpaid. Lists that need extra credits are paused until the payment goes through.
        </Banner>
      ) : null}
      <div className={cx("rounded-2xl transition-shadow duration-500", highlight && "ring-2 ring-border-focus-ring")}>
        <SettingsCard>
          <SettingsRow label="Keep enriching when credits run out" description={description}>
            <Switch
              aria-label="Keep enriching when credits run out"
              size="sm"
              isSelected={enabled}
              onChange={onToggle}
              isDisabled={!manageable || switchPending}
              className={cx("shrink-0 transition-opacity", switchPending && "opacity-60")}
            />
          </SettingsRow>
          {enabled ? (
            <SettingsRow label="Monthly limit" description="Lists pause once this many extra credits were used in a calendar month.">
              <Select
                aria-label="Monthly overspend limit"
                size="sm"
                selectedKey={limitKey}
                isDisabled={!data.canManage || limitPending}
                onSelectionChange={(k) => changeLimit(k === "none" ? null : Number(k))}
                triggerClassName="w-full sm:w-[260px]"
                popoverClassName="w-[280px]"
              >
                {presets.map((p) => (
                  <SelectItem key={p.credits ?? "none"} id={p.credits == null ? "none" : String(p.credits)} textValue={p.label}>
                    {p.label}
                  </SelectItem>
                ))}
              </Select>
            </SettingsRow>
          ) : null}
          {enabled ? (
            <SettingsRow label="This month" description={limit != null ? `${fmt(Math.max(0, limit - data.usedThisMonth))} of ${fmt(limit)} credits left under the limit.` : "Extra credits used beyond your balance."}>
              <span className="text-body-2-regular text-text-tertiary tabular-nums">
                {data.usedThisMonth > 0 ? `${fmt(data.usedThisMonth)} credits · ${formatUsdExact(data.usedAmountCents)}` : "Nothing charged yet"}
              </span>
            </SettingsRow>
          ) : null}
          {eligible ? (
            <SettingsRow label="Payment method" description="Overspend invoices are charged to this card automatically.">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-body-2-regular text-text-secondary">
                  <RiBankCardLine className="size-4 text-foreground-icon-secondary" aria-hidden />
                  {cardLabel(data.card)}
                </span>
                {data.canManage ? (
                  <Button variant="secondary" size="small" onClick={onOpenPortal} disabled={portalPending}>
                    {data.card ? "Update" : "Add card"}
                  </Button>
                ) : null}
              </span>
            </SettingsRow>
          ) : null}
        </SettingsCard>
      </div>

      <ConfirmDialog
        isOpen={confirming}
        onOpenChange={(o) => !o && !switchPending && setConfirming(false)}
        title="Turn on overspend?"
        description="Lists keep enriching when your credits run out. Here is what you agree to:"
        icon={RiBankCardLine}
        tone="primary"
        confirmLabel={switchPending ? "Turning on…" : "Turn on overspend"}
        isPending={switchPending}
        onConfirm={confirmEnable}
      >
        <ul className="flex list-disc flex-col gap-1.5 ps-4">
          <li>Credits beyond your balance cost {data.rate} each, the same price per credit as your plan.</li>
          <li>Each list is invoiced when it finishes or is stopped, and the invoice is charged to {cardLabel(data.card)} automatically.</li>
          <li>{limit != null ? `At most ${fmt(limit)} extra credits per month; lists pause when the limit is reached.` : "You can set a monthly limit; without one, lists run until they finish."}</li>
          <li>You can turn this off any time. Lists you start can opt out individually.</li>
        </ul>
      </ConfirmDialog>
    </div>
  );
}
