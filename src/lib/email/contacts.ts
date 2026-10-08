import "server-only";

import { resend } from "@/lib/email/resend";

/**
 * Adds a new user to Resend contacts as subscribed (and to the
 * `RESEND_SEGMENT_ID` segment when set). An existing contact is left
 * untouched so a previous unsubscribe is never overridden. Never throws:
 * signup must not depend on the marketing list.
 */
export async function subscribeContact({ email, fullName }: { email: string; fullName?: string | null }): Promise<void> {
  const address = email.trim().toLowerCase();
  try {
    const existing = await resend().contacts.get({ email: address });
    if (existing.data) return;
    if (existing.error && existing.error.name !== "not_found") throw new Error(existing.error.message);

    // The signup trigger falls back to the email's local part when there is no
    // real name; that is not a name to greet anyone with.
    const name = (fullName ?? "").trim();
    const [firstName, ...rest] = name.toLowerCase() === address.split("@")[0] ? [] : name.split(/\s+/);
    const segmentId = process.env.RESEND_SEGMENT_ID;
    const { error } = await resend().contacts.create({
      email: address,
      unsubscribed: false,
      firstName: firstName || undefined,
      lastName: rest.join(" ") || undefined,
      segments: segmentId ? [{ id: segmentId }] : undefined,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("[subscribeContact] failed", error instanceof Error ? error.message : error);
  }
}
