"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/base/toast/toast";
import { SettingsModal, type SettingsPage } from "./settings-modal";
import type { BillingView } from "./settings-billing";
import { useSettingsUrl } from "./use-settings-url";
import type { SettingsProfileProps } from "./settings-profile";

const PAGES: SettingsPage[] = ["profile", "workspace", "billing"];

export interface SettingsHostProps {
  profile: Omit<SettingsProfileProps, "onSaved">;
}

/**
 * Mounted once in the app shell. URL-driven so every entry point is a link:
 *   ?settings=profile|billing   opens the modal on that page
 *   &plan=1                     opens Billing on the plan picker (&short=N adds the shortfall line)
 *   &checkout=success|cancelled|switched   toast after returning from Stripe
 * Closing strips the params (history.replaceState: no history entry and no
 * server round trip, see `use-settings-url.ts`).
 */
export function SettingsHost({ profile }: SettingsHostProps) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { closeSettings, setBillingView, stripParams } = useSettingsUrl();

  const requested = params.get("settings");
  const page: SettingsPage | null = PAGES.includes(requested as SettingsPage) ? (requested as SettingsPage) : null;
  const billingView: BillingView = params.get("plan") === "1" ? "plans" : "overview";
  const shortBy = Number(params.get("short")) || 0;
  const planReason = shortBy > 0 ? `You need ${shortBy.toLocaleString("en-US")} more credits to start.` : undefined;
  const checkout = params.get("checkout");

  const [refreshKey, setRefreshKey] = useState(0);
  const handledCheckout = useRef<string | null>(null);

  // Return from Stripe. The refresh timers live in a ref: stripping the
  // `checkout` param re-runs this effect, and an effect cleanup would cancel
  // them before the webhook grant arrives.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!checkout || handledCheckout.current === checkout) return;
    handledCheckout.current = checkout;
    if (checkout === "success") {
      toast.success("Payment received", { description: "Your credits arrive within a minute. This page refreshes automatically." });
    } else if (checkout === "switched") {
      toast.success("Plan updated", { description: "Any extra credits arrive within a minute." });
    } else if (checkout === "cancelled") {
      toast.neutral("Checkout cancelled", { description: "No charge was made." });
    }
    stripParams(["checkout"]);
    if (checkout === "cancelled") return;
    // The webhook lands shortly after the redirect: refresh a few times so the
    // header balance and the Billing page pick up the grant without a reload.
    timers.current.push(
      ...[2000, 6000, 15000, 30000].map((ms) =>
        setTimeout(() => {
          router.refresh();
          setRefreshKey((k) => k + 1);
        }, ms),
      ),
    );
  }, [checkout, router, stripParams, toast]);

  const close = useCallback(() => closeSettings(), [closeSettings]);

  return (
    <SettingsModal
      isOpen={page !== null}
      onClose={close}
      defaultPage={page ?? "profile"}
      profile={profile}
      billingView={billingView}
      onBillingViewChange={setBillingView}
      planReason={planReason}
      billingRefreshKey={refreshKey}
    />
  );
}
