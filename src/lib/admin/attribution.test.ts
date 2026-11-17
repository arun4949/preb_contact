import { describe, expect, it } from "vitest";
import { META_ATTRIBUTION_META, metaAttribution } from "./attribution";

describe("metaAttribution", () => {
  it("is an ad click only when a click id was stored", () => {
    expect(metaAttribution({ fbc: "fb.1.1794861811557.AbCd", fbp: "fb.1.1794861811557.111" })).toBe("ad_click");
    expect(metaAttribution({ fbc: "fb.1.1794861811557.AbCd", fbp: null })).toBe("ad_click");
  });

  it("does not read the browser cookie alone as an ad click", () => {
    expect(metaAttribution({ fbc: null, fbp: "fb.1.1794861811557.111" })).toBe("cookie_only");
  });

  it("is none without a row or with an empty one", () => {
    expect(metaAttribution(null)).toBe("none");
    expect(metaAttribution(undefined)).toBe("none");
    expect(metaAttribution({ fbc: null, fbp: null })).toBe("none");
    expect(metaAttribution({ fbc: "", fbp: "" })).toBe("none");
  });

  it("has a label for every verdict", () => {
    for (const key of ["ad_click", "cookie_only", "none"] as const) expect(META_ATTRIBUTION_META[key].label).toBeTruthy();
  });
});
