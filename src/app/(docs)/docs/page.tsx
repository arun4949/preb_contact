import type { Metadata } from "next";
import Link from "next/link";
import { DocsCollectionCard } from "@/components/application/docs/docs-collection-card";
import { DocsSearch } from "@/components/application/docs/docs-search";
import { DocsSupportCard } from "@/components/application/docs/docs-support-card";
import { DOCS_COLLECTIONS, findArticle } from "@/lib/docs/registry";
import { docsPath } from "@/lib/site-links";

export const metadata: Metadata = {
  title: "Help center",
  description: "Answers for recruiters and sales teams using Preb: lists, enrichment, credits, billing and your workspace.",
  alternates: { canonical: docsPath() },
};

const POPULAR = ["first-list-in-five-minutes", "how-credits-work", "email-statuses", "prepare-your-spreadsheet", "invite-your-team", "download-your-list"];

export default function DocsHomePage() {
  const popular = POPULAR.map(findArticle).filter((a): a is NonNullable<typeof a> => a !== undefined);
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-center gap-5 pt-4 text-center md:pt-8">
        <h1 className="text-display-4-semibold text-text-primary md:text-display-3-semibold">How can we help?</h1>
        <p className="max-w-[560px] text-body-regular text-text-secondary">Short, plain answers about uploading lists, reading results, credits and your team. Search, or pick a topic below.</p>
        <DocsSearch size="medium" className="w-full max-w-[640px] text-start" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DOCS_COLLECTIONS.map((c) => (
          <DocsCollectionCard key={c.slug} collection={c} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-headline-medium text-text-primary">Popular articles</h2>
        <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          {popular.map((a) => (
            <li key={a.slug}>
              <Link href={a.href} className="inline-flex rounded-sm text-body-regular text-text-secondary underline-offset-3 outline-none hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <DocsSupportCard />
    </div>
  );
}
