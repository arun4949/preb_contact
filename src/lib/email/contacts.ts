import "server-only";

import { resend } from "@/lib/email/resend";
import { splitName } from "@/lib/email/name";

/**
 * Resend contact list for product news (sent as Resend Broadcasts, which add
 * their own unsubscribe link and honour `unsubscribed`). The profile column
 * `product_news` mirrors the contact's state; `/api/webhooks/resend` keeps the
 * two in sync when someone unsubscribes from an email. Every helper is
 * best-effort and never throws: signup, settings and deletion must not depend
 * on the marketing list.
 */

function logFailure(scope: string, error: unknown) {
  console.error(`[${scope}] failed`, error instanceof Error ? error.message : error);
}

/**
 * Adds a new user as subscribed (and to the `RESEND_SEGMENT_ID` segment when
 * set). An existing contact is left untouched so a previous unsubscribe is
 * never overridden.
 */
export async function subscribeContact({ email, fullName }: { email: string; fullName?: string | null }): Promise<void> {
  const address = email.trim().toLowerCase();
  try {
    const existing = await resend().contacts.get({ email: address });
    if (existing.data) return;
    if (existing.error && existing.error.name !== "not_found") throw new Error(existing.error.message);

    const { firstName, lastName } = splitName(fullName, address);
    const segmentId = process.env.RESEND_SEGMENT_ID;
    const { error } = await resend().contacts.create({
      email: address,
      unsubscribed: false,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      segments: segmentId ? [{ id: segmentId }] : undefined,
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    logFailure("subscribeContact", error);
  }
}

/**
 * Mirrors the in-app "Product news" switch onto the Resend contact. Turning it
 * on for an address Resend has never seen creates the contact.
 */
export async function setContactSubscribed({ email, fullName, subscribed }: { email: string; fullName?: string | null; subscribed: boolean }): Promise<void> {
  const address = email.trim().toLowerCase();
  try {
    const { error } = await resend().contacts.update({ email: address, unsubscribed: !subscribed });
    if (!error) return;
    if (error.name === "not_found") {
      if (subscribed) await subscribeContact({ email: address, fullName });
      return;
    }
    throw new Error(error.message);
  } catch (error) {
    logFailure("setContactSubscribed", error);
  }
}

/** Account deletion: the contact disappears from Resend as well. */
export async function removeContact(email: string): Promise<void> {
  const address = email.trim().toLowerCase();
  try {
    const { error } = await resend().contacts.remove({ email: address });
    if (error && error.name !== "not_found") throw new Error(error.message);
  } catch (error) {
    logFailure("removeContact", error);
  }
}
