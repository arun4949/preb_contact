import { docsPath } from "@/lib/site-links";
import { toPlainText } from "./inline";
import { createIdAllocator } from "./slug";
import type { DocsArticle, DocsArticleRef, DocsCollection, DocsCollectionSlug, DocsNavCollection, DocsSearchEntry, DocsTocItem } from "./types";
import { gettingStarted } from "./content/getting-started";
import { lists } from "./content/lists";
import { enrich } from "./content/enrich";
import { data } from "./content/data";
import { billing } from "./content/billing";
import { workspace } from "./content/workspace";
import { troubleshooting } from "./content/troubleshooting";

/** Sidebar and home page order. */
export const DOCS_COLLECTIONS: readonly DocsCollection[] = [gettingStarted, lists, enrich, data, billing, workspace, troubleshooting];

export const CONTACT_PATH = `${docsPath()}/contact`;

export function collectionHref(slug: DocsCollectionSlug) {
  return docsPath(slug);
}

export function articleHref(collection: DocsCollectionSlug, slug: string) {
  return docsPath(collection, slug);
}

function toRef(c: DocsCollection, a: DocsArticle): DocsArticleRef {
  return { slug: a.slug, title: a.title, summary: a.summary, collection: c.slug, collectionTitle: c.title, href: articleHref(c.slug, a.slug) };
}

const ALL: readonly { collection: DocsCollection; article: DocsArticle; ref: DocsArticleRef }[] = DOCS_COLLECTIONS.flatMap((c) =>
  c.articles.map((a) => ({ collection: c, article: a, ref: toRef(c, a) })),
);

const BY_SLUG = new Map(ALL.map((e) => [e.article.slug, e]));

export function allArticles(): readonly DocsArticleRef[] {
  return ALL.map((e) => e.ref);
}

export function getCollection(slug: string): DocsCollection | undefined {
  return DOCS_COLLECTIONS.find((c) => c.slug === slug);
}

/** The article only when it lives in that collection, so a wrong collection in the URL is a 404. */
export function getArticle(collection: string, slug: string): { collection: DocsCollection; article: DocsArticle; ref: DocsArticleRef } | undefined {
  const entry = BY_SLUG.get(slug);
  return entry && entry.collection.slug === collection ? entry : undefined;
}

export function findArticle(slug: string): DocsArticleRef | undefined {
  return BY_SLUG.get(slug)?.ref;
}

/** Previous and next article in sidebar order, across collection boundaries. */
export function prevNext(slug: string): { prev: DocsArticleRef | null; next: DocsArticleRef | null } {
  const i = ALL.findIndex((e) => e.article.slug === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: i > 0 ? ALL[i - 1].ref : null, next: i < ALL.length - 1 ? ALL[i + 1].ref : null };
}

/** Heading anchors in document order; the renderer uses the same allocator so ids always agree. */
export function tocOf(article: DocsArticle): DocsTocItem[] {
  const id = createIdAllocator();
  return article.blocks.flatMap((b) => (b.type === "heading" ? [{ id: id(b.text), text: toPlainText(b.text) }] : []));
}

/** Every string of an article, for the search index and the copy lint. */
export function stringsOf(article: DocsArticle): string[] {
  const out: string[] = [article.title, article.summary, ...article.keywords];
  for (const b of article.blocks) {
    switch (b.type) {
      case "heading":
      case "subheading":
      case "paragraph":
        out.push(b.text);
        break;
      case "steps":
      case "list":
        out.push(...b.items);
        break;
      case "callout":
        if (b.title) out.push(b.title);
        out.push(b.text);
        break;
      case "table":
        out.push(...b.columns, ...b.rows.flat());
        break;
    }
  }
  return out;
}

export function searchTextOf(article: DocsArticle): string {
  return stringsOf(article)
    .map(toPlainText)
    .join(" ")
    .toLowerCase();
}

export const DOCS_NAV: readonly DocsNavCollection[] = DOCS_COLLECTIONS.map((c) => ({
  slug: c.slug,
  title: c.title,
  href: collectionHref(c.slug),
  articles: c.articles.map((a) => ({ slug: a.slug, title: a.title, href: articleHref(c.slug, a.slug) })),
}));

export const SEARCH_INDEX: readonly DocsSearchEntry[] = ALL.map((e) => ({ ...e.ref, keywords: e.article.keywords.map((k) => k.toLowerCase()), text: searchTextOf(e.article) }));

/** Latest `updated` date across the help center, for the sitemap. */
export function latestUpdate(): string {
  return ALL.reduce((max, e) => (e.article.updated > max ? e.article.updated : max), "2026-01-01");
}
