import Link from "next/link";
import type { DocsCollection } from "@/lib/docs/types";
import { collectionHref } from "@/lib/docs/registry";
import { COLLECTION_ICON } from "./collection-icons";

export function DocsCollectionCard({ collection }: { collection: DocsCollection }) {
  const Icon = COLLECTION_ICON[collection.slug];
  const n = collection.articles.length;
  return (
    <Link
      href={collectionHref(collection.slug)}
      className="flex flex-col gap-4 rounded-3xl border border-border-button-default bg-background-primary-default p-5 outline-none transition-colors duration-150 ease hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-headline-medium text-text-primary">{collection.title}</span>
        <span className="text-body-2-regular text-text-secondary">{collection.summary}</span>
      </span>
      <span className="mt-auto text-caption-1-regular text-text-tertiary">
        {n} {n === 1 ? "article" : "articles"}
      </span>
    </Link>
  );
}
