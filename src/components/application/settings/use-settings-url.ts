"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { SettingsPage } from "./settings-modal";
import type { BillingView } from "./settings-billing";

/**
 * Settings state lives in the URL (`?settings=page&plan=1&short=N&overspend=1&checkout=…`)
 * so every entry point is a link and emails can deep-link. Updating it goes
 * through `window.history.replaceState`, which the Next router picks up and
 * feeds to `useSearchParams` *without* re-rendering the server layout and page
 * (that round trip is what made the modal lag). Full page loads still read the
 * params the normal way.
 */
export function useSettingsUrl() {
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      const qs = next.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname],
  );

  const openSettings = useCallback(
    (page: SettingsPage, opts: { plan?: boolean; short?: number; overspend?: boolean } = {}) =>
      apply((next) => {
        next.set("settings", page);
        if (opts.plan) next.set("plan", "1");
        else next.delete("plan");
        if (opts.short && opts.short > 0) next.set("short", String(Math.ceil(opts.short)));
        else next.delete("short");
        // `&overspend=1` scrolls Billing to the Overspend section and highlights it.
        if (opts.overspend) next.set("overspend", "1");
        else next.delete("overspend");
      }),
    [apply],
  );

  const closeSettings = useCallback(() => apply((next) => ["settings", "plan", "short", "overspend"].forEach((k) => next.delete(k))), [apply]);

  const setBillingView = useCallback(
    (view: BillingView) =>
      apply((next) => {
        if (view === "plans") {
          next.set("plan", "1");
          next.delete("overspend");
        } else {
          next.delete("plan");
          next.delete("short");
        }
      }),
    [apply],
  );

  const stripParams = useCallback((keys: string[]) => apply((next) => keys.forEach((k) => next.delete(k))), [apply]);

  /** Marks a Stripe return on the current page; the host shows the toast and refreshes. */
  const setCheckout = useCallback(
    (value: "success" | "cancelled" | "switched") =>
      apply((next) => {
        next.set("settings", "billing");
        next.delete("plan");
        next.delete("short");
        next.set("checkout", value);
      }),
    [apply],
  );

  return { openSettings, closeSettings, setBillingView, setCheckout, stripParams };
}
