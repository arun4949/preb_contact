import { emailDomain, isFreeEmailDomain } from "@/lib/auth/work-email";

/**
 * Workspace naming helpers, mirroring the signup trigger (`handle_new_user`,
 * migration 0004) so a workspace created later in-app looks the same as one
 * created at signup.
 */

/** Default workspace name: the company part of the domain, or "<name>'s workspace" for free-mail addresses. */
export function suggestWorkspaceName(email: string, fullName: string | null | undefined): string {
  const domain = emailDomain(email);
  if (!domain || isFreeEmailDomain(email)) {
    const first = fullName?.trim().split(/\s+/)[0] || email.split("@")[0] || "My";
    return `${first}'s workspace`;
  }
  const company = domain.split(".")[0] ?? "";
  return company.charAt(0).toUpperCase() + company.slice(1);
}

/** URL slug from a name plus a 6-char random suffix (unique column). */
export function workspaceSlug(name: string, suffix: string = randomSuffix()): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "workspace"}-${suffix}`;
}

function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}
