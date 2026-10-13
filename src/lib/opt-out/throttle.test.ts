import { describe, expect, it } from "vitest";
import { isThrottled, throttleKey } from "./throttle";

describe("opt-out throttle", () => {
  it("allows the first hits in a window and blocks after the limit", () => {
    const key = throttleKey("1.1.1.1", "ua");
    const limits = { windowMs: 1000, max: 2 };
    expect(isThrottled(key, 0, limits)).toBe(false);
    expect(isThrottled(key, 1, limits)).toBe(false);
    expect(isThrottled(key, 2, limits)).toBe(true);
    // A new window starts fresh.
    expect(isThrottled(key, 2000, limits)).toBe(false);
  });

  it("hashes ip and user agent, never storing them", () => {
    expect(throttleKey("1.1.1.1", "ua")).toMatch(/^[0-9a-f]{64}$/);
    expect(throttleKey("1.1.1.1", "ua")).not.toBe(throttleKey("1.1.1.2", "ua"));
  });
});
