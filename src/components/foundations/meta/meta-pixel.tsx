"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ADS_CONSENT_COOKIE, ADS_CONSENT_VALUE } from "@/lib/meta/consent";
import "@/lib/meta/client";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function setConsentCookie() {
  document.cookie = `${ADS_CONSENT_COOKIE}=${ADS_CONSENT_VALUE}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`;
}

function clearConsentCookie() {
  document.cookie = `${ADS_CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax; Secure`;
}

/** Termly reports consent either as a category → boolean map or as a list of accepted categories. */
function advertisingAllowed(payload: unknown): boolean | null {
  if (!payload || typeof payload !== "object") return null;
  const state = payload as { categories?: unknown; advertising?: unknown };
  const categories = state.categories ?? state;
  if (Array.isArray(categories)) return categories.includes("advertising");
  if (categories && typeof categories === "object" && "advertising" in categories) {
    return Boolean((categories as { advertising?: unknown }).advertising);
  }
  return null;
}

/**
 * Meta Pixel, consent-gated by Termly. `autoConfig` is off so the pixel does not
 * record button clicks (SubscribedButtonClick) or page metadata on its own.
 * The bootstrap is rendered as
 * `type="text/plain" data-categories="advertising"`, which Termly's resource
 * blocker keeps inert until the visitor accepts advertising cookies and then
 * executes. The executed script also sets the first-party consent cookie the
 * Conversions API checks before sending server events; the Termly consent
 * listener clears it when consent is withdrawn.
 */
export function MetaPixel({ pixelId }: { pixelId: string | null }) {
  const pathname = usePathname();
  const firstPath = useRef(true);

  // Route changes: the bootstrap only fires PageView once, the app is a SPA.
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (typeof window.fbq === "function") window.fbq("track", "PageView");
  }, [pathname]);

  // Keep the consent cookie in sync with Termly (withdrawal has no script to run).
  useEffect(() => {
    if (!pixelId) return;
    const apply = (payload: unknown) => {
      const allowed = advertisingAllowed(payload);
      if (allowed === true) setConsentCookie();
      else if (allowed === false) clearConsentCookie();
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
  }, [pixelId]);

  if (!pixelId) return null;

  const bootstrap = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('set','autoConfig',false,${JSON.stringify(pixelId)});fbq('init',${JSON.stringify(pixelId)});fbq('track','PageView');document.cookie=${JSON.stringify(`${ADS_CONSENT_COOKIE}=${ADS_CONSENT_VALUE}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`)};`;

  return <script id="meta-pixel" type="text/plain" data-categories="advertising" dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
