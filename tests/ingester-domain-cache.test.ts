/**
 * Unit tests for the ingester domain cache invalidator.
 *
 * Key assertion: invalidateDomainCaches must call deleteCache with the EXACT
 * key string returned by getDomainByIdCacheKey(id) from @opensend/core.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDomainByIdCacheKey } from "../packages/core/src/cache/domain-cache-keys";

const mockDeleteCache = vi.fn();

vi.mock("../packages/ingester/src/cache/redis", () => ({
  deleteCache: mockDeleteCache,
  isRedisConfigured: vi.fn().mockReturnValue(true),
}));

describe("ingester invalidateDomainCaches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteCache.mockResolvedValue("deleted");
  });

  it("calls deleteCache with the exact key returned by getDomainByIdCacheKey(id)", async () => {
    const { invalidateDomainCaches } = await import(
      "../packages/ingester/src/cache/domain-cache"
    );

    const id = "11111111-1111-4111-8111-111111111111";
    await invalidateDomainCaches({ id, name: null });

    expect(mockDeleteCache).toHaveBeenCalledWith(getDomainByIdCacheKey(id));
  });

  it("calls deleteCache with the identity key for the given region", async () => {
    const { invalidateDomainCaches } = await import(
      "../packages/ingester/src/cache/domain-cache"
    );

    await invalidateDomainCaches({
      id: null,
      name: "example.com",
      region: "eu-west-1",
    });

    expect(mockDeleteCache).toHaveBeenCalledWith(
      "domain:identity:eu-west-1:example.com",
    );
  });

  it("does not throw when deleteCache rejects — logs and swallows the error", async () => {
    mockDeleteCache.mockRejectedValue(new Error("Redis is down"));

    const { invalidateDomainCaches } = await import(
      "../packages/ingester/src/cache/domain-cache"
    );

    await expect(
      invalidateDomainCaches({
        id: "id-1",
        name: "example.com",
        region: "us-east-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("is a no-op when both id and name are null/undefined", async () => {
    const { invalidateDomainCaches } = await import(
      "../packages/ingester/src/cache/domain-cache"
    );

    await invalidateDomainCaches({});

    expect(mockDeleteCache).not.toHaveBeenCalled();
  });
});
