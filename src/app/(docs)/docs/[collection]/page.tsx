import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { ChevronRightSmall } from "@/components/foundations/icons/chevrons";
import { COLLECTION_ICON } from "@/components/application/docs/collection-icons";
import { DocsSupportCard } from "@/components/application/docs/docs-support-card";
import { DOCS_COLLECTIONS, articleHref, collectionHref, getCollection } from "@/lib/docs/registry";
import { docsPath } from "@/lib/site-links";

/** Unknown slugs render `notFound()` inside the docs layout (a routing-level 404 would use the root page). */
export const dynamicParams = true;

export function generateStaticParams() {
  return DOCS_COLLECTIONS.map((c) => ({ collection: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[collection]">): Promise<Metadata> {
  const { collection } = await params;
  const c = getCollection(collection);
  if (!c) return {};
  const href = collectionHref(c.slug);
  return { title: c.title, description: c.summary, alternates: { canonical: href }, openGraph: { title: c.title, description: c.summary, url: href } };
}

export default async function DocsCollectionPage({ params }: PageProps<"/docs/[collection]">) {
  const { collection } = await params;
  const c = getCollection(collection);
  if (!c) notFound();
  const Icon = COLLECTION_ICON[c.slug];
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <Breadcrumb>
        <BreadcrumbItem href={docsPath()}>Help center</BreadcrumbItem>
        <BreadcrumbItem current>{c.title}</BreadcrumbItem>
      </Breadcrumb>
      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background-secondary-default text-foreground-icon-secondary">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-title-1-semibold text-text-primary md:text-display-4-semibold">{c.title}</h1>
          <p className="text-body-regular text-text-secondary">{c.summary}</p>
        </div>
      </header>
      <ul className="flex flex-col divide-y divide-separator-border rounded-3xl border border-border-button-default bg-background-primary-default">
        {c.articles.map((a) => (
          <li key={a.slug}>
            <Link
              href={articleHref(c.slug, a.slug)}
              className="flex items-center justify-between gap-4 px-5 py-4 outline-none transition-colors duration-150 ease first:rounded-t-3xl last:rounded-b-3xl hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body-medium text-text-primary">{a.title}</span>
                <span className="text-body-2-regular text-text-secondary">{a.summary}</span>
              </span>
              <ChevronRightSmall className="size-3.5 shrink-0 text-text-tertiary rtl:rotate-180" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <DocsSupportCard />
    </div>
  );
}
