"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Attribute the dashboard search input carries so `/` can focus it. */
export const SEARCH_SHORTCUT_ATTR = "data-shortcut-search";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.getAttribute("role") === "textbox";
}

/**
 * Global keyboard shortcuts: `N` → new list, `/` → focus search.
 * Ignored while typing, with modifiers, or when a dialog/popover is open.
 */
export function useGlobalShortcuts() {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      if (document.querySelector("[role='dialog'], [data-rac][data-entering]")) return;

      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        router.push("/lists/new");
      } else if (event.key === "/") {
        const host = document.querySelector<HTMLElement>(`[${SEARCH_SHORTCUT_ATTR}]`);
        const el = host instanceof HTMLInputElement ? host : host?.querySelector("input");
        if (el) {
          event.preventDefault();
          el.focus();
          el.select();
        }
      }
    };
    // Capture phase: React Aria buttons stop keydown propagation when focused.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router]);
}
