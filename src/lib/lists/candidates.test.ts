import { describe, expect, it } from "vitest";
import { fullRecord, invalidRecord } from "@/lib/fullenrich/__fixtures__/records";
import type { Json } from "@/lib/supabase/types";
import { emailCandidates, phoneCandidates } from "./candidates";

const asJson = (v: unknown) => v as Json;

describe("candidates", () => {
  it("returns nothing for missing or malformed results", () => {
    expect(emailCandidates(null, "work")).toEqual([]);
    expect(emailCandidates("nope", "work")).toEqual([]);
    expect(emailCandidates(asJson({ contact_info: [] }), "personal")).toEqual([]);
    expect(phoneCandidates(asJson({ contact_info: { phones: "x" } }))).toEqual([]);
  });

  it("puts the most probable entry first, drops invalid and duplicate addresses", () => {
    const record = {
      ...fullRecord,
      contact_info: {
        ...fullRecord.contact_info!,
        most_probable_personal_email: { email: "second@gmail.com", status: "DELIVERABLE" },
        personal_emails: [
          { email: "first@gmail.com", status: "HIGH_PROBABILITY" },
          { email: "Second@gmail.com", status: "DELIVERABLE" },
          { email: "dead@gmail.com", status: "INVALID" },
          { email: "", status: "DELIVERABLE" },
        ],
      },
    };
    expect(emailCandidates(asJson(record), "personal")).toEqual([
      { email: "second@gmail.com", level: "valid" },
      { email: "first@gmail.com", level: "probable" },
    ]);
    expect(emailCandidates(asJson(fullRecord), "work")).toEqual([{ email: "gregoire@fullenrich.com", level: "valid" }]);
    expect(emailCandidates(asJson(invalidRecord), "work")).toEqual([]);
  });

  it("keeps usable phones, most probable first, and drops inactive and duplicate numbers", () => {
    const record = {
      ...fullRecord,
      contact_info: {
        ...fullRecord.contact_info!,
        phones: [
          { number: "+33 1 00 00 00 00", line_type: "LANDLINE" },
          { number: "+33612345678", line_type: "MOBILE" },
          { number: "+33 7 00 00 00 00", line_type: "MOBILE", line_status: "INACTIVE" },
        ],
      },
    };
    expect(phoneCandidates(asJson(record)).map((p) => p.number)).toEqual(["+33 6 12 34 56 78", "+33 1 00 00 00 00"]);
  });
});
