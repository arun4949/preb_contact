import Link from "next/link";
import { ChevronRightSmall } from "@/components/foundations/icons/chevrons";
import type { DocsArticleRef } from "@/lib/docs/types";

export function DocsRelated({ items }: { items: DocsArticleRef[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-headline-medium text-text-primary">Related articles</h2>
      <ul className="flex flex-col divide-y divide-separator-border rounded-2xl border border-border-button-default bg-background-primary-default">
        {items.map((a) => (
          <li key={a.slug}>
            <Link href={a.href} className="flex items-center justify-between gap-3 px-4 py-3 outline-none transition-colors duration-150 ease first:rounded-t-2xl last:rounded-b-2xl hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body-medium text-text-primary">{a.title}</span>
                <span className="line-clamp-1 text-caption-1-regular text-text-secondary">{a.summary}</span>
              </span>
              <ChevronRightSmall className="size-3.5 shrink-0 text-text-tertiary rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
