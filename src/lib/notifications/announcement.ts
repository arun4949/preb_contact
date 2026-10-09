/** Client-safe shape and validation of an admin announcement (shared by the composer and the server action). */
export type AnnouncementAudience = "all" | "users" | "workspaces";

export interface AnnouncementInput {
  title: string;
  body: string;
  href: string;
  audience: AnnouncementAudience;
  targetIds: string[];
}

export const TITLE_MAX = 80;
export const BODY_MAX = 500;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateAnnouncement(input: AnnouncementInput): string | null {
  const title = input.title.trim();
  const body = input.body.trim();
  const href = input.href.trim();
  if (title.length < 2) return "Give the announcement a title.";
  if (title.length > TITLE_MAX) return `Keep the title under ${TITLE_MAX} characters.`;
  if (body.length < 2) return "Write a message.";
  if (body.length > BODY_MAX) return `Keep the message under ${BODY_MAX} characters.`;
  if (href && !(href.startsWith("/") || href.startsWith("https://"))) return "The link must start with https:// or be a path inside the app.";
  if (!["all", "users", "workspaces"].includes(input.audience)) return "Choose an audience.";
  if (input.audience !== "all") {
    if (input.targetIds.length === 0) return input.audience === "users" ? "Pick at least one user." : "Pick at least one workspace.";
    if (!input.targetIds.every((id) => UUID_RE.test(id))) return "Invalid recipient.";
  }
  return null;
}
