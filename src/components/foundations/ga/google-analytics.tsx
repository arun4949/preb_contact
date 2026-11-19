"use client";

import { useEffect } from "react";
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VALUE } from "@/lib/ga/config";
import { termlyCategoryAllowed } from "@/lib/termly/consent";
import "@/lib/ga/client";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const CONSENT_COOKIE = `${ANALYTICS_CONSENT_COOKIE}=${ANALYTICS_CONSENT_VALUE}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;

/**
 * Termly does not remove the GA cookies on withdrawal, so they are expired
 * here. gtag.js writes them on the registrable domain (`.preb.co`, shared
 * with the website); localhost has none, so both variants are cleared.
 */
function clearGaCookies() {
  const host = window.location.hostname;
  const root = host.split(".").slice(-2).join(".");
  const names = document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim())
    .filter((n): n is string => Boolean(n) && (n === "_ga" || n.startsWith("_ga_")));
  for (const name of names) {
    document.cookie = `${name}=; path=/; max-age=0`;
    if (root.includes(".")) document.cookie = `${name}=; path=/; max-age=0; domain=.${root}`;
  }
}

/**
 * Google Analytics 4, consent-gated by Termly like the Meta Pixel: the
 * bootstrap is `type="text/plain" data-categories="analytics"`, which Termly's
 * resource blocker keeps inert until the visitor accepts analytics cookies.
 * The same measurement id runs on the Framer website, and gtag.js sets its
 * cookies on `.preb.co`, so a visitor keeps one client id from preb.co into
 * the app.
 *
 * Page views on client-side navigation come from GA's enhanced measurement
 * ("page changes based on browser history events", switched on in the
 * stream), so nothing here fires page_view by hand; doing so would count
 * every route twice.
 */
export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  // Withdrawal has no script to run: clear the server-side consent flag and
  // stop the already loaded tag for the rest of this page's life.
  useEffect(() => {
    if (!measurementId) return;
    const apply = (payload: unknown) => {
      const allowed = termlyCategoryAllowed(payload, "analytics");
      if (allowed === true) {
        document.cookie = CONSENT_COOKIE;
        (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = false;
      } else if (allowed === false) {
        document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax; Secure`;
        (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = true;
        clearGaCookies();
      }
    };
    let subscribed = false;
    const subscribe = () => {
      const termly = window.Termly;
      if (subscribed || !termly?.on) return;
      subscribed = true;
      try {
        termly.on("consent", apply);
        if (termly.getConsentState) apply(termly.getConsentState());
      } catch {
        // Termly API differences must never break the app.
      }
    };
    subscribe();
    window.addEventListener("termly:loaded", subscribe);
    return () => window.removeEventListener("termly:loaded", subscribe);
  }, [measurementId]);

  if (!measurementId) return null;

  const id = JSON.stringify(measurementId);
  const bootstrap = `window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments)};window.gtag('js',new Date());window.gtag('config',${id});(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+${id};document.head.appendChild(s)})();document.cookie=${JSON.stringify(CONSENT_COOKIE)};`;

  return <script id="google-analytics" type="text/plain" data-categories="analytics" dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
