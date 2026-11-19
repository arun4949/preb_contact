/**
 * Termly reports consent either as a category → boolean map or as a list of
 * accepted categories (both shapes seen in its event payloads). Returns null
 * when the payload says nothing about the category.
 */
export function termlyCategoryAllowed(payload: unknown, category: "advertising" | "analytics"): boolean | null {
  if (!payload || typeof payload !== "object") return null;
  const state = payload as { categories?: unknown };
  const categories = state.categories ?? state;
  if (Array.isArray(categories)) return categories.includes(category);
  if (categories && typeof categories === "object" && category in categories) {
    return Boolean((categories as Record<string, unknown>)[category]);
  }
  return null;
}
