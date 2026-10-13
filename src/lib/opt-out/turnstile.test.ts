import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, verifyTurnstile } from "./turnstile";

const ok = () => Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
const fail = () => Promise.resolve(new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }));

describe("verifyTurnstile", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts the token form-encoded and accepts success", async () => {
    const fetchImpl = vi.fn(ok);
    await expect(verifyTurnstile("tok", "1.2.3.4", fetchImpl as unknown as typeof fetch)).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(String(init.body)).toBe("secret=secret&response=tok&remoteip=1.2.3.4");
  });

  it("rejects a failed check, a network error and a missing token", async () => {
    await expect(verifyTurnstile("tok", null, vi.fn(fail) as unknown as typeof fetch)).resolves.toBe(false);
    await expect(verifyTurnstile("tok", null, vi.fn(() => Promise.reject(new Error("down"))) as unknown as typeof fetch)).resolves.toBe(false);
    const fetchImpl = vi.fn(ok);
    await expect(verifyTurnstile(null, null, fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed without a secret", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchImpl = vi.fn(ok);
    await expect(verifyTurnstile("tok", null, fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("clientIp", () => {
  it("takes the first forwarded hop", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBeNull();
  });
});
