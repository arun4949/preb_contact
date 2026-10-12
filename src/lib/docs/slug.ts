import { toPlainText } from "./inline";

/** Anchor id for a heading: lowercase words joined by hyphens. */
export function headingId(text: string): string {
  return toPlainText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Keeps ids unique within one article ("results", "results-2", …). */
export function createIdAllocator() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = headingId(text) || "section";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}-${count}`;
  };
}
