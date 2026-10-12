"use client";

import { useEffect, useState } from "react";
import type { DocsTocItem } from "@/lib/docs/types";
import { cx } from "@/utils/cx";

/** "On this page" rail. The heading nearest the top of the viewport is highlighted. */
export function DocsToc({ items }: { items: DocsTocItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = headings.find((h) => visible.has(h.id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <span className="text-caption-1-semibold text-text-tertiary">On this page</span>
      <ul className="flex flex-col gap-0.5 border-s border-separator-border">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active ? "location" : undefined}
                className={cx(
                  "-ms-px block border-s-2 py-1 ps-3 text-body-2-regular outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring",
                  active ? "border-accent-600 text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary",
                )}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
