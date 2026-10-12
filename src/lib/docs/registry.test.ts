import { describe, expect, it } from "vitest";
import { linksIn, parseInline, toPlainText } from "./inline";
import { CONTACT_PATH, DOCS_COLLECTIONS, DOCS_NAV, SEARCH_INDEX, allArticles, articleHref, collectionHref, findArticle, getArticle, prevNext, stringsOf, tocOf } from "./registry";
import { searchDocs } from "./search";

const all = DOCS_COLLECTIONS.flatMap((c) => c.articles.map((a) => ({ c, a })));

describe("docs registry", () => {
  it("has non-empty collections with unique slugs", () => {
    const slugs = DOCS_COLLECTIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of DOCS_COLLECTIONS) expect(c.articles.length, c.slug).toBeGreaterThan(0);
  });

  it("has globally unique, url-safe article slugs", () => {
    const slugs = all.map(({ a }) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("dates every article", () => {
    for (const { a } of all) {
      expect(a.updated, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(a.updated)), a.slug).toBe(false);
    }
  });

  it("links related articles that exist and are not the article itself", () => {
    for (const { a } of all) {
      for (const r of a.related) {
        expect(findArticle(r), `${a.slug} → ${r}`).toBeDefined();
        expect(r, a.slug).not.toBe(a.slug);
      }
    }
  });

  it("resolves every internal link to a docs page", () => {
    const pages = new Set<string>([CONTACT_PATH, "/docs"]);
    for (const c of DOCS_COLLECTIONS) {
      pages.add(collectionHref(c.slug));
      for (const a of c.articles) pages.add(articleHref(c.slug, a.slug));
    }
    for (const { a } of all) {
      for (const s of stringsOf(a)) {
        for (const href of linksIn(s)) {
          if (href.startsWith("/")) expect(pages.has(href.split("#")[0]), `${a.slug}: ${href}`).toBe(true);
          else expect(href, `${a.slug}: ${href}`).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("never uses dashes as punctuation, and never names the provider", () => {
    for (const { a } of all) {
      for (const s of stringsOf(a)) {
        const text = s.replace(/\d[–-]\d/g, "0"); // numeric ranges are allowed
        expect(text, `${a.slug}: ${s}`).not.toMatch(/—|–| - /);
        expect(s.toLowerCase(), `${a.slug}: ${s}`).not.toContain("fullenrich");
      }
    }
  });

  it("keeps inline markup balanced", () => {
    for (const { a } of all) {
      for (const s of stringsOf(a)) {
        const plain = toPlainText(s);
        expect(plain, `${a.slug}: ${s}`).not.toMatch(/\*\*|`|\]\(/);
      }
    }
  });

  it("gives every heading a unique anchor and every article a search text", () => {
    for (const { a } of all) {
      const ids = tocOf(a).map((t) => t.id);
      expect(new Set(ids).size, a.slug).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
      const entry = SEARCH_INDEX.find((e) => e.slug === a.slug)!;
      expect(entry.text).toContain(a.title.toLowerCase());
    }
  });

  it("derives nav and refs from the same hrefs", () => {
    expect(DOCS_NAV.map((n) => n.slug)).toEqual(DOCS_COLLECTIONS.map((c) => c.slug));
    for (const n of DOCS_NAV) for (const a of n.articles) expect(findArticle(a.slug)?.href).toBe(a.href);
    expect(allArticles().length).toBe(all.length);
  });

  it("walks previous and next across the whole help center", () => {
    const first = all[0].a.slug;
    const last = all[all.length - 1].a.slug;
    expect(prevNext(first).prev).toBeNull();
    expect(prevNext(last).next).toBeNull();
    expect(prevNext(all[1].a.slug).prev?.slug).toBe(first);
    expect(prevNext("nope")).toEqual({ prev: null, next: null });
  });

  it("returns an article only under its own collection", () => {
    const { c, a } = all[0];
    expect(getArticle(c.slug, a.slug)?.article.slug).toBe(a.slug);
    expect(getArticle("billing", a.slug)).toBeUndefined();
  });
});

describe("inline markup", () => {
  it("parses labels, keys and links", () => {
    expect(parseInline("Click **Start** or press `N`, see [docs](/docs/x).")).toEqual([
      { kind: "text", text: "Click " },
      { kind: "label", text: "Start" },
      { kind: "text", text: " or press " },
      { kind: "kbd", text: "N" },
      { kind: "text", text: ", see " },
      { kind: "link", text: "docs", href: "/docs/x" },
      { kind: "text", text: "." },
    ]);
  });
  it("leaves plain text alone", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
    expect(toPlainText("**a** `b` [c](/d)")).toBe("a b c");
  });
});

describe("search", () => {
  it("ranks title matches first and requires every token", () => {
    const hits = searchDocs(SEARCH_INDEX, "credits expire");
    expect(hits[0]?.slug).toBe("credit-expiry");
    expect(searchDocs(SEARCH_INDEX, "")).toEqual([]);
    expect(searchDocs(SEARCH_INDEX, "zzzz qqqq")).toEqual([]);
    expect(searchDocs(SEARCH_INDEX, "CSV", 3).length).toBeLessThanOrEqual(3);
    expect(searchDocs(SEARCH_INDEX, "csv")[0]?.collection).toBe("lists");
  });
});
