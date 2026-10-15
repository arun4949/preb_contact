import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMetaPayload, fbcFromClickId, hashMetaValue, normalizeEmail, postMetaPayload, sendMetaEventDetached } from "./capi";

describe("meta conversions api payload", () => {
  it("normalises and hashes the email, hashes the external id, passes browser ids raw", () => {
    const payload = buildMetaPayload(
      {
        eventName: "CompleteRegistration",
        eventId: "evt-1",
        userData: { email: "  Ada@Example.COM ", externalId: "user-1", fbp: "fb.1.1.2", fbc: "fb.1.1.abc", clientIp: "1.2.3.4", userAgent: "UA" },
      },
      { eventTime: 1700000000 },
    );
    const event = (payload.data as Record<string, unknown>[])[0];
    expect(event.event_name).toBe("CompleteRegistration");
    expect(event.event_id).toBe("evt-1");
    expect(event.event_time).toBe(1700000000);
    expect(event.action_source).toBe("website");
    const user = event.user_data as Record<string, string>;
    expect(user.em).toBe(hashMetaValue("ada@example.com"));
    expect(user.em).toMatch(/^[0-9a-f]{64}$/);
    expect(user.external_id).toBe(hashMetaValue("user-1"));
    expect(user.fbp).toBe("fb.1.1.2");
    expect(user.fbc).toBe("fb.1.1.abc");
    expect(user.client_ip_address).toBe("1.2.3.4");
    expect(user.client_user_agent).toBe("UA");
    expect(event.custom_data).toBeUndefined();
    expect(payload.test_event_code).toBeUndefined();
  });

  it("adds value, currency, custom data, source url and the test event code", () => {
    const payload = buildMetaPayload(
      { eventName: "Purchase", eventId: "purchase:in_1", value: 36.5, currency: "usd", customData: { content_name: "p2_1000_m" }, sourceUrl: "https://app.preb.co/lists" },
      { testEventCode: "TEST123", eventTime: 1 },
    );
    const event = (payload.data as Record<string, unknown>[])[0];
    expect(event.custom_data).toEqual({ content_name: "p2_1000_m", value: 36.5, currency: "USD" });
    expect(event.event_source_url).toBe("https://app.preb.co/lists");
    expect(payload.test_event_code).toBe("TEST123");
  });

  it("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.io\n")).toBe("foo@bar.io");
  });

  it("builds an _fbc value from a click id", () => {
    expect(fbcFromClickId("abc", 1700000000000)).toBe("fb.1.1700000000000.abc");
    expect(fbcFromClickId("", 1)).toBeNull();
    expect(fbcFromClickId(undefined)).toBeNull();
  });
});

describe("meta conversions api transport", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "123");
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "token");
    vi.stubEnv("META_TEST_EVENT_CODE", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("posts to the dataset endpoint with the access token in the body", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const ok = await postMetaPayload({ data: [] }, fetchImpl as unknown as typeof fetch);
    expect(ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v22.0/123/events");
    expect(JSON.parse(String(init.body))).toEqual({ data: [], access_token: "token" });
  });

  it("returns false on a rejected request and never throws", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 400 }));
    await expect(postMetaPayload({ data: [] }, fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
    const failing = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(postMetaPayload({ data: [] }, failing as unknown as typeof fetch)).resolves.toBe(false);
  });

  it("is a no-op without the keys", async () => {
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "");
    const fetchImpl = vi.fn();
    await sendMetaEventDetached({ eventName: "Purchase", eventId: "x" }, true, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends nothing without consent", async () => {
    const fetchImpl = vi.fn();
    await sendMetaEventDetached({ eventName: "Purchase", eventId: "x" }, false, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends with consent", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    await sendMetaEventDetached({ eventName: "Purchase", eventId: "x", value: 1, currency: "USD" }, true, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
