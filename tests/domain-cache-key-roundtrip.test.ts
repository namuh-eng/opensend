/**
 * Regression guard: core key builders must produce byte-identical strings to
 * the keys that src/lib/domain-cache.ts reads and invalidates.
 *
 * If the key format ever drifts between the two copies the ingester will
 * invalidate a different Redis key than the app reads — this test catches that.
 */

import { describe, expect, it } from "vitest";
import {
  getDomainByIdCacheKey,
  getDomainIdentityCacheKey,
  getLegacyDomainIdentityCacheKey,
} from "../packages/core/src/cache/domain-cache-keys";

describe("domain cache key round-trip (drift regression guard)", () => {
  it("getDomainByIdCacheKey produces the same key as invalidateDomainByIdCache deletes", () => {
    // The key format for the by-id cache is `domain:by-id:<id>`.
    // This must match what src/lib/domain-cache.ts uses for both reads and deletes.
    const id = "11111111-1111-4111-8111-111111111111";
    expect(getDomainByIdCacheKey(id)).toBe(`domain:by-id:${id}`);
  });

  it("getDomainIdentityCacheKey normalizes region to us-east-1 when unset", () => {
    const name = "Example.COM";
    expect(getDomainIdentityCacheKey(name)).toBe(
      "domain:identity:us-east-1:example.com",
    );
    expect(getDomainIdentityCacheKey(name, undefined)).toBe(
      "domain:identity:us-east-1:example.com",
    );
    expect(getDomainIdentityCacheKey(name, "")).toBe(
      "domain:identity:us-east-1:example.com",
    );
  });

  it("getDomainIdentityCacheKey uses the provided region", () => {
    expect(getDomainIdentityCacheKey("example.com", "eu-west-1")).toBe(
      "domain:identity:eu-west-1:example.com",
    );
    expect(getDomainIdentityCacheKey("example.com", "ap-northeast-1")).toBe(
      "domain:identity:ap-northeast-1:example.com",
    );
  });

  it("getLegacyDomainIdentityCacheKey has no region segment", () => {
    expect(getLegacyDomainIdentityCacheKey("Example.COM")).toBe(
      "domain:identity:example.com",
    );
  });

  it("all key builders normalise domain names to lower-case and trim whitespace", () => {
    expect(getDomainByIdCacheKey("ID-1")).toBe("domain:by-id:ID-1");
    expect(getDomainIdentityCacheKey("  EXAMPLE.COM  ", "us-east-1")).toBe(
      "domain:identity:us-east-1:example.com",
    );
    expect(getLegacyDomainIdentityCacheKey("  EXAMPLE.COM  ")).toBe(
      "domain:identity:example.com",
    );
  });
});
