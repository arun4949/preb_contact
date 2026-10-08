"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/base/toast/toast";
import { SettingsModal, type SettingsPage } from "./settings-modal";
import type { BillingView } from "./settings-billing";
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
 * Closing strips the params (replace, no history entry).
 */
export function SettingsHost({ profile }: SettingsHostProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();

  const requested = params.get("settings");
  const page: SettingsPage | null = PAGES.includes(requested as SettingsPage) ? (requested as SettingsPage) : null;
  const billingView: BillingView = params.get("plan") === "1" ? "plans" : "overview";
  const shortBy = Number(params.get("short")) || 0;
  const planReason = shortBy > 0 ? `You need ${shortBy.toLocaleString("en-US")} more credits to start.` : undefined;
  const checkout = params.get("checkout");

  const [refreshKey, setRefreshKey] = useState(0);
  const handledCheckout = useRef<string | null>(null);

  const stripParams = useCallback(
    (keys: string[]) => {
      const next = new URLSearchParams(params.toString());
      keys.forEach((k) => next.delete(k));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  // Plan picker: a Billing sub-view driven by `&plan=1` (set by the Billing
  // page, the credits dropdown, emails and the paused panels); leaving strips it.
  const setBillingView = useCallback(
    (view: BillingView) => {
      if (view === "overview") {
        stripParams(["plan", "short"]);
        return;
      }
      const next = new URLSearchParams(params.toString());
      next.set("plan", "1");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router, stripParams],
  );

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

  const close = useCallback(() => {
    stripParams(["settings", "plan", "short"]);
  }, [stripParams]);

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
