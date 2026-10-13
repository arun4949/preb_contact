import { describe, expect, it } from "vitest";
import { NOTE_MAX_LENGTH, parseOptOutForm } from "./validate";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseOptOutForm", () => {
  it("requires a valid email and lower-cases it", () => {
    expect(parseOptOutForm(form({ email: " Ada@Example.com " }))).toEqual({
      ok: true,
      data: { email: "ada@example.com", phone: null, linkedin: null, note: null, honeypot: false },
    });
    expect(parseOptOutForm(form({ email: "not an email" }))).toMatchObject({ ok: false, field: "email" });
    expect(parseOptOutForm(form({}))).toMatchObject({ ok: false, field: "email" });
  });

  it("normalises an optional phone number to E.164 for the chosen country", () => {
    const res = parseOptOutForm(form({ email: "a@b.co", phone: "0151 12345678", phone_country: "DE" }));
    expect(res).toMatchObject({ ok: true, data: { phone: "+4915112345678" } });
    expect(parseOptOutForm(form({ email: "a@b.co", phone: "12", phone_country: "DE" }))).toMatchObject({ ok: false, field: "phone" });
  });

  it("canonicalises an optional LinkedIn URL", () => {
    const res = parseOptOutForm(form({ email: "a@b.co", linkedin: "LinkedIn.com/in/Ada-Lovelace/" }));
    expect(res).toMatchObject({ ok: true, data: { linkedin: "https://www.linkedin.com/in/ada-lovelace" } });
    expect(parseOptOutForm(form({ email: "a@b.co", linkedin: "https://example.com/ada" }))).toMatchObject({ ok: false, field: "linkedin" });
  });

  it("trims and caps the note", () => {
    expect(parseOptOutForm(form({ email: "a@b.co", note: "  Acme   Recruiting \n called me " }))).toMatchObject({ ok: true, data: { note: "Acme Recruiting called me" } });
    expect(parseOptOutForm(form({ email: "a@b.co", note: "x".repeat(NOTE_MAX_LENGTH + 1) }))).toMatchObject({ ok: false, field: "note" });
  });

  it("flags the honeypot", () => {
    expect(parseOptOutForm(form({ email: "a@b.co", fax: "123" }))).toMatchObject({ ok: true, data: { honeypot: true } });
  });
});
