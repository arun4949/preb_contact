"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import Script from "next/script";
import { cx } from "@/utils/cx";

/**
 * Cloudflare Turnstile widget in explicit render mode. The widget writes its
 * token into a hidden `cf-turnstile-response` input of the enclosing form; the
 * server action must verify it (see `lib/opt-out/turnstile.ts`). Tokens are
 * single use, so the form calls `reset()` after every failed submit.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string | undefined;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileHandle {
  reset: () => void;
}

export interface TurnstileProps {
  siteKey: string;
  ref?: Ref<TurnstileHandle>;
  className?: string;
  /** Fires when Cloudflare reports an error or the token expired without renewal. */
  onError?: () => void;
}

export function Turnstile({ siteKey, ref, className, onError }: TurnstileProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!ready || !container.current || !window.turnstile || widgetId.current) return;
    const el = container.current;
    widgetId.current = window.turnstile.render(el, {
      sitekey: siteKey,
      appearance: "interaction-only",
      size: "flexible",
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      "refresh-expired": "auto",
      "error-callback": () => onError?.(),
      "expired-callback": () => onError?.(),
    });
    return () => {
      if (widgetId.current) {
        try {
          window.turnstile?.remove(widgetId.current);
        } catch {
          // The widget may already be gone after a navigation.
        }
        widgetId.current = undefined;
      }
    };
    // onError is read through the closure; the widget is rendered once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, siteKey]);

  return (
    <>
      {/* onReady also fires when the script was loaded by an earlier page, unlike onLoad. */}
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={() => setReady(true)} data-categories="essential" />
      <div ref={container} className={cx("empty:hidden", className)} />
    </>
  );
}
