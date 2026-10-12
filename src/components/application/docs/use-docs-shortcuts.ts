"use client";

import { useEffect } from "react";
import { SEARCH_SHORTCUT_ATTR } from "@/components/application/header/use-shortcuts";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "textbox";
}

/**
 * `/` focuses the help center search. The app's `useGlobalShortcuts` also
 * binds `N` to a new list, which has no place on public pages.
 */
export function useDocsShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector("[role='dialog']:not(iframe)")) return;
      const host = document.querySelector<HTMLElement>(`[${SEARCH_SHORTCUT_ATTR}]`);
      const el = host instanceof HTMLInputElement ? host : host?.querySelector("input");
      if (el) {
        event.preventDefault();
        el.focus();
        el.select();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
