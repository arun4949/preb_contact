/**
 * Public help center content model. Articles are plain data so the table of
 * contents, the search index and the copy lint (no dashes, no provider name)
 * all derive from the same source. Inline markup inside any string:
 *   **Start enrichment**  a UI label, rendered bold exactly as the app shows it
 *   `N`                   a keyboard key
 *   [text](/docs/…)       a link, internal or external
 */

export type DocsCollectionSlug =
  | "getting-started"
  | "lists"
  | "enrich"
  | "data"
  | "billing"
  | "workspace"
  | "troubleshooting";

export type DocsCalloutTone = "note" | "tip" | "important";

export type DocsBlock =
  /** Section heading (h2). Gets an anchor id and a table-of-contents entry. */
  | { type: "heading"; text: string }
  /** Minor heading (h3), no table-of-contents entry. */
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  /** Numbered steps the reader performs in the app. */
  | { type: "steps"; items: string[] }
  /** Bulleted list. */
  | { type: "list"; items: string[] }
  | { type: "callout"; tone: DocsCalloutTone; title?: string; text: string }
  | { type: "table"; columns: string[]; rows: string[][] };

export interface DocsArticle {
  /** Globally unique, kebab-case; part of the URL and used in `related`. */
  slug: string;
  title: string;
  /** One sentence; meta description and search snippet. */
  summary: string;
  /** Extra words people type when searching for this article. */
  keywords: string[];
  /** Last content change, YYYY-MM-DD. Bump on every edit. */
  updated: string;
  /** Slugs of related articles, shown at the end of the article. */
  related: string[];
  blocks: DocsBlock[];
}

export interface DocsCollection {
  slug: DocsCollectionSlug;
  title: string;
  summary: string;
  /** Sidebar order, which is also the previous and next order. */
  articles: DocsArticle[];
}

/** An article with its collection, as the shell and search need it. */
export interface DocsArticleRef {
  slug: string;
  title: string;
  summary: string;
  collection: DocsCollectionSlug;
  collectionTitle: string;
  href: string;
}

export interface DocsTocItem {
  id: string;
  text: string;
}

export interface DocsNavCollection {
  slug: DocsCollectionSlug;
  title: string;
  href: string;
  articles: { slug: string; title: string; href: string }[];
}

export interface DocsSearchEntry extends DocsArticleRef {
  keywords: string[];
  /** Lowercased plain text of the whole article. */
  text: string;
}
