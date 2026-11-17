"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Makes every body row of the table inside it open `${base}/${row id}` on
 * click. The row's name cell carries a real link, which is what keyboard and
 * screen reader users follow and what opens in a new tab; this wrapper only
 * widens the pointer target to the whole row. Clicks on links and buttons
 * inside a row, and clicks that end a text selection, are left alone.
 * Rows need an `id` (React Aria writes it to `data-key`).
 */
export function RowLinks({ base, children }: { base: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a, button, input, [role='button']")) return;
        const row = target.closest("tbody tr[data-key]");
        const key = row?.getAttribute("data-key");
        if (!key || window.getSelection()?.toString()) return;
        const href = `${base}/${key}`;
        if (event.metaKey || event.ctrlKey) window.open(href, "_blank", "noopener");
        else router.push(href);
      }}
    >
      {children}
    </div>
  );
}
