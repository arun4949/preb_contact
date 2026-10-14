import { firstNameFor } from "@/lib/email/name";

/**
 * How the lead owner (the founder who reached out) is shown on the public
 * page and in the popup: first name plus a portrait from /public/portraits.
 * Admins without a portrait fall back to their profile picture or initials.
 */
const PORTRAITS: Record<string, string> = {
  "leon@preb.co": "/portraits/leon.png",
  "arun@preb.co": "/portraits/arun.png",
  "ar.gupta494@gmail.com": "/portraits/arun.png",
};

export interface LeadOwnerView {
  /** "Leon" */
  firstName: string;
  /** "Leon Kranz" or the email when the profile has no name */
  fullName: string;
  /** Static portrait or profile avatar, null when neither exists */
  imageUrl: string | null;
}

export function leadOwnerView(profile: { full_name: string | null; email: string; avatar_url: string | null }): LeadOwnerView {
  const firstName = firstNameFor(profile.full_name, profile.email) || "Preb";
  const portrait = PORTRAITS[profile.email.trim().toLowerCase()] ?? profile.avatar_url ?? null;
  return { firstName, fullName: profile.full_name?.trim() || profile.email, imageUrl: portrait };
}
