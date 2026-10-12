import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb, BreadcrumbItem } from "@/components/base/breadcrumb/breadcrumb";
import { DocsArticle } from "@/components/application/docs/docs-article";
import { DocsFeedback } from "@/components/application/docs/docs-feedback";
import { DocsPrevNext } from "@/components/application/docs/docs-prev-next";
import { DocsRelated } from "@/components/application/docs/docs-related";
import { DocsSupportCard } from "@/components/application/docs/docs-support-card";
import { DocsToc } from "@/components/application/docs/docs-toc";
import { allArticles, collectionHref, findArticle, getArticle, prevNext, tocOf } from "@/lib/docs/registry";
import { docsPath } from "@/lib/site-links";

/** Unknown slugs render `notFound()` inside the docs layout (a routing-level 404 would use the root page). */
export const dynamicParams = true;

export function generateStaticParams() {
  return allArticles().map((a) => ({ collection: a.collection, article: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[collection]/[article]">): Promise<Metadata> {
  const { collection, article } = await params;
  const entry = getArticle(collection, article);
  if (!entry) return {};
  const { ref, article: a } = entry;
  return {
    title: a.title,
    description: a.summary,
    alternates: { canonical: ref.href },
    openGraph: { type: "article", title: a.title, description: a.summary, url: ref.href, modifiedTime: a.updated },
  };
}

const updatedLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function DocsArticlePage({ params }: PageProps<"/docs/[collection]/[article]">) {
  const { collection, article } = await params;
  const entry = getArticle(collection, article);
  if (!entry) notFound();
  const { collection: c, article: a } = entry;
  const toc = tocOf(a);
  const { prev, next } = prevNext(a.slug);
  const related = a.related.map(findArticle).filter((r): r is NonNullable<typeof r> => r !== undefined);

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_200px] xl:gap-10">
      <article className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-8">
        <Breadcrumb>
          <BreadcrumbItem href={docsPath()}>Help center</BreadcrumbItem>
          <BreadcrumbItem href={collectionHref(c.slug)}>{c.title}</BreadcrumbItem>
          <BreadcrumbItem current>{a.title}</BreadcrumbItem>
        </Breadcrumb>
        <header className="flex flex-col gap-3">
          <h1 className="text-title-1-semibold text-text-primary md:text-display-4-semibold">{a.title}</h1>
          <p className="text-body-regular text-text-secondary">{a.summary}</p>
          <p className="text-caption-1-regular text-text-tertiary">
            Updated <time dateTime={a.updated}>{updatedLabel(a.updated)}</time>
          </p>
        </header>
        <DocsArticle blocks={a.blocks} />
        <DocsFeedback slug={a.slug} />
        <DocsPrevNext prev={prev} next={next} />
        <DocsRelated items={related} />
        <DocsSupportCard />
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-24">
          <DocsToc items={toc} />
        </div>
      </aside>
    </div>
  );
}
