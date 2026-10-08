"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    Termly?: { initialize: () => void };
    displayPreferenceModal?: () => void;
  }
}

const SCRIPT_SRC_BASE = "https://app.termly.io";

interface TermlyCMPProps {
  websiteUUID: string;
  autoBlock?: boolean;
  masterConsentsOrigin?: string;
}

/**
 * Termly consent banner (per Termly's Next.js 15/16 guide). Loads the resource
 * blocker once and re-initializes it on client-side navigation. Must sit inside
 * a <Suspense> boundary because it reads useSearchParams().
 */
export function TermlyCMP({ websiteUUID, autoBlock, masterConsentsOrigin }: TermlyCMPProps) {
  const scriptSrc = useMemo(() => {
    const src = new URL(SCRIPT_SRC_BASE);
    src.pathname = `/resource-blocker/${websiteUUID}`;
    if (autoBlock) src.searchParams.set("autoBlock", "on");
    if (masterConsentsOrigin) src.searchParams.set("masterConsentsOrigin", masterConsentsOrigin);
    return src.toString();
  }, [autoBlock, masterConsentsOrigin, websiteUUID]);

  // Deduped by src instead of a ref + cleanup: under Strict Mode the guide's
  // cleanup removes the tag on the simulated remount and never re-adds it.
  useEffect(() => {
    if (document.querySelector(`script[src="${scriptSrc}"]`)) return;
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    document.head.appendChild(script);
  }, [scriptSrc]);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    try {
      window.Termly?.initialize();
    } catch (e) {
      console.warn("Termly initialize failed:", e);
    }
  }, [pathname, searchParams]);

  return null;
}

/** Opens Termly's consent preference center (no-op until the script has loaded). */
export function openCookiePreferences() {
  window.displayPreferenceModal?.();
}

/** Text link that reopens the preference center; for footers rendered by server components. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className}>
      Cookie preferences
    </button>
  );
}
