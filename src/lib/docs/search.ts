import type { DocsSearchEntry } from "./types";

export interface DocsSearchHit extends DocsSearchEntry {
  score: number;
}

const MIN_TOKEN = 2;

export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_TOKEN);
}

/**
 * Client-side search over the whole help center. Every token must match
 * somewhere; the title counts most, then keywords, summary and body.
 */
export function searchDocs(index: readonly DocsSearchEntry[], query: string, limit = 8): DocsSearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const hits: DocsSearchHit[] = [];
  for (const entry of index) {
    const title = entry.title.toLowerCase();
    const summary = entry.summary.toLowerCase();
    let score = 0;
    let all = true;
    for (const token of tokens) {
      let s = 0;
      if (title.startsWith(token)) s += 8;
      else if (title.includes(token)) s += 5;
      if (entry.keywords.some((k) => k === token)) s += 4;
      else if (entry.keywords.some((k) => k.includes(token))) s += 2;
      if (summary.includes(token)) s += 2;
      if (entry.text.includes(token)) s += 1;
      if (s === 0) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) hits.push({ ...entry, score });
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return hits.slice(0, limit);
}
