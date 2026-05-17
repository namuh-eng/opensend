import { createUnsubscribeToken } from "@/lib/unsubscribe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getUnsubscribeSecret (production guard)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when UNSUBSCRIBE_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "some-other-secret-1234567890");
    expect(() => createUnsubscribeToken("c1")).toThrowError(
      /UNSUBSCRIBE_SECRET must be set/,
    );
  });

  it("throws in production when UNSUBSCRIBE_SECRET is too short", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "short");
    expect(() => createUnsubscribeToken("c1")).toThrowError(
      /must be set to at least 16 chars/,
    );
  });

  it("does not fall back to BETTER_AUTH_SECRET in production", () => {
    // Even with BETTER_AUTH_SECRET set, missing UNSUBSCRIBE_SECRET must fail.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "a-very-long-better-auth-secret-12345");
    vi.stubEnv("DASHBOARD_KEY", "another-fallback-secret-long-enough");
    expect(() => createUnsubscribeToken("c1")).toThrow();
  });

  it("accepts a 16+ char UNSUBSCRIBE_SECRET in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "this-is-long-enough-secret");
    expect(createUnsubscribeToken("c1")).toEqual(expect.any(String));
  });

  it("uses dev fallback in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UNSUBSCRIBE_SECRET", "");
    expect(createUnsubscribeToken("c1")).toEqual(expect.any(String));
  });
});
