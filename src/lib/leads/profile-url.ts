import { cleanLinkedin } from "@/lib/csv/normalize";

export type LeadProfileSource = "linkedin" | "reddit" | "other";

/**
 * Where the lead came from: a LinkedIn profile (normalised as before) or any
 * other public http(s) URL, e.g. a Reddit user or post. Stored in
 * `lead_shares.lead_linkedin_url` and rendered as a link, so anything that is
 * not a plain web URL (javascript:, data:, mailto:, bare words) is rejected.
 */
export function cleanLeadProfileUrl(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v || /\s/.test(v)) return null;
  if (/linkedin\.com\//i.test(v)) return cleanLinkedin(v);
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v.replace(/^\/\//, "")}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
  url.protocol = "https:";
  const out = url.toString();
  return out.length <= 300 ? out : null;
}

export function leadProfileSource(url: string): LeadProfileSource {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return "linkedin";
  if (host === "reddit.com" || host.endsWith(".reddit.com") || host === "redd.it") return "reddit";
  return "other";
}
