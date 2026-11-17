/**
 * Where an account came from, as far as Meta is concerned. A stored click id
 * (`fbc`) means the person clicked one of our ads. The browser id (`fbp`)
 * alone only means they accepted advertising cookies on the site. No row
 * means no advertising consent at signup, or the row passed its 90 days.
 */
export type MetaAttribution = "ad_click" | "cookie_only" | "none";

export function metaAttribution(context: { fbc: string | null; fbp: string | null } | null | undefined): MetaAttribution {
  if (!context) return "none";
  if (context.fbc) return "ad_click";
  return context.fbp ? "cookie_only" : "none";
}

export const META_ATTRIBUTION_META: Record<MetaAttribution, { label: string; description: string; color: "blue" | "neutral" }> = {
  ad_click: { label: "Meta ad click", description: "A Meta click id was stored at signup, so this person came from one of our ads.", color: "blue" },
  cookie_only: { label: "Meta cookie only", description: "Advertising cookies were accepted, but there was no ad click.", color: "neutral" },
  none: { label: "No Meta data", description: "No advertising consent at signup, or the record is older than 90 days.", color: "neutral" },
};
