import { describe, expect, it } from "vitest";
import { E164_PATTERN, PHONE_COUNTRIES, formatAsYouType, formatPhone, normalizePhone, toPhoneCountry } from "./phone";

describe("normalizePhone", () => {
  it("turns a national number into E.164 for the selected country", () => {
    expect(normalizePhone("0151 12345678", "DE")).toEqual({ e164: "+4915112345678", country: "DE" });
    expect(normalizePhone("(415) 555-2671", "US")).toEqual({ e164: "+14155552671", country: "US" });
    expect(normalizePhone("07400 123456", "GB")).toEqual({ e164: "+447400123456", country: "GB" });
  });

  it("accepts a pasted international number regardless of the selected country", () => {
    expect(normalizePhone("+49 151 12345678", "US")).toEqual({ e164: "+4915112345678", country: "DE" });
  });

  it("rejects empty and invalid input", () => {
    expect(normalizePhone("", "DE")).toBeNull();
    expect(normalizePhone("   ", "DE")).toBeNull();
    expect(normalizePhone("123", "DE")).toBeNull();
    expect(normalizePhone("hello", "US")).toBeNull();
    expect(normalizePhone("555-0100", "US")).toBeNull();
  });

  it("produces values the database check constraint accepts, including short territories", () => {
    const samples = [normalizePhone("0151 12345678", "DE"), normalizePhone("(415) 555-2671", "US"), normalizePhone("22158", "SH")];
    for (const s of samples) {
      expect(s).not.toBeNull();
      expect(E164_PATTERN.test(s!.e164)).toBe(true);
    }
  });
});

describe("formatting", () => {
  it("formats a stored number for display", () => {
    expect(formatPhone("+4915112345678")).toBe("+49 1511 2345678");
    expect(formatPhone("+14155552671")).toBe("+1 415 555 2671");
  });

  it("formats as you type and detects the country of a pasted number", () => {
    expect(formatAsYouType("4155552671", "US").text).toBe("(415) 555-2671");
    expect(formatAsYouType("+4915112345678", "US").detectedCountry).toBe("DE");
    expect(formatAsYouType("4155552671", "US").detectedCountry).toBeUndefined();
  });
});

describe("countries", () => {
  it("lists real countries with flag, name and dial code, sorted by name", () => {
    const de = PHONE_COUNTRIES.find((c) => c.iso2 === "DE");
    expect(de).toEqual({ iso2: "DE", name: "Germany", dial: "49" });
    const names = PHONE_COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(200);
  });

  it("narrows a geo header to a supported country with a fallback", () => {
    expect(toPhoneCountry("de")).toBe("DE");
    expect(toPhoneCountry("XX")).toBe("US");
    expect(toPhoneCountry(null, "DE")).toBe("DE");
  });
});

describe("formatAsYouType with user-typed spaces", () => {
  it("ignores the user's own spacing and formats from the digits", () => {
    expect(formatAsYouType("0151 123 45678", "DE").text).toBe("01511 2345678");
    expect(formatAsYouType("+44 7400 123456", "DE").text).toBe("+44 7400 123456");
  });
});

describe("country names", () => {
  it("come from the static table so server and browser render the same text", () => {
    expect(PHONE_COUNTRIES.every((c) => c.name !== c.iso2)).toBe(true);
    expect(PHONE_COUNTRIES.find((c) => c.iso2 === "FK")?.name).toBe("Falkland Islands");
  });
});
