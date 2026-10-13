import { cleanEmail } from "@/lib/csv/normalize";
import { normalizePhone } from "@/lib/phone/phone";
import { normaliseIdentifier } from "@/lib/suppression/identifiers";

/**
 * Pure validation of the public opt-out form. Field names match the inputs on
 * /opt-out. `fax` is the honeypot: real people never see it, bots fill it.
 */
export type OptOutField = "email" | "phone" | "linkedin" | "note";

export interface OptOutInput {
  email: string;
  /** E.164, or null when the field was left empty. */
  phone: string | null;
  /** Canonical lower-cased LinkedIn URL, or null when left empty. */
  linkedin: string | null;
  note: string | null;
  honeypot: boolean;
}

export type OptOutParse = { ok: true; data: OptOutInput } | { ok: false; field: OptOutField; message: string };

export const NOTE_MAX_LENGTH = 1000;

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export function parseOptOutForm(formData: FormData): OptOutParse {
  const email = cleanEmail(text(formData, "email"));
  if (!email) return { ok: false, field: "email", message: "Enter a valid email address." };

  const phoneRaw = text(formData, "phone");
  const phone = phoneRaw ? normalizePhone(phoneRaw, text(formData, "phone_country")) : null;
  if (phoneRaw && !phone) return { ok: false, field: "phone", message: "Enter a valid phone number, or leave it empty." };

  const linkedinRaw = text(formData, "linkedin");
  const linkedin = linkedinRaw ? normaliseIdentifier("linkedin", linkedinRaw) : null;
  if (linkedinRaw && !linkedin) return { ok: false, field: "linkedin", message: "Enter a LinkedIn profile URL such as linkedin.com/in/your-handle, or leave it empty." };

  const noteRaw = text(formData, "note").replace(/\s+/g, " ");
  if (noteRaw.length > NOTE_MAX_LENGTH) return { ok: false, field: "note", message: `Keep the note under ${NOTE_MAX_LENGTH} characters.` };

  return {
    ok: true,
    data: { email, phone: phone?.e164 ?? null, linkedin, note: noteRaw || null, honeypot: text(formData, "fax").length > 0 },
  };
}
