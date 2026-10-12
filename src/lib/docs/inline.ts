/**
 * Inline markup used inside docs strings (see `types.ts`). Pure functions so
 * the renderer, the search index and the tests share one parser.
 */
export type InlineNode =
  | { kind: "text"; text: string }
  | { kind: "label"; text: string }
  | { kind: "kbd"; text: string }
  | { kind: "link"; text: string; href: string };

const TOKEN = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push({ kind: "text", text: text.slice(last, index) });
    if (match[1] !== undefined) nodes.push({ kind: "label", text: match[1] });
    else if (match[2] !== undefined) nodes.push({ kind: "kbd", text: match[2] });
    else nodes.push({ kind: "link", text: match[3], href: match[4] });
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push({ kind: "text", text: text.slice(last) });
  return nodes;
}

/** The string without any markup, for search text and heading ids. */
export function toPlainText(text: string): string {
  return parseInline(text)
    .map((n) => n.text)
    .join("");
}

/** Every link target in a string, for the registry test. */
export function linksIn(text: string): string[] {
  return parseInline(text).flatMap((n) => (n.kind === "link" ? [n.href] : []));
}
