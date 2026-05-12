import { beforeEach, describe, expect, it, vi } from "vitest";

const mockReadCache = vi.hoisted(() => vi.fn());
const mockWriteCache = vi.hoisted(() => vi.fn());
const mockDeleteCache = vi.hoisted(() => vi.fn());
const mockGetDomainIdentity = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cache/redis", () => ({
  readCache: mockReadCache,
  writeCache: mockWriteCache,
  deleteCache: mockDeleteCache,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      domains: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/ses", () => ({
  getDomainIdentity: mockGetDomainIdentity,
}));

describe("domain cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadCache.mockResolvedValue({ status: "miss" });
    mockWriteCache.mockResolvedValue("written");
    mockDeleteCache.mockResolvedValue("deleted");
    mockGetDomainIdentity.mockResolvedValue({
      verified: true,
      dkimStatus: "SUCCESS",
      dkimTokens: [],
    });
  });

  it("keys SES identity cache by domain and region", async () => {
    const { getCachedDomainIdentity } = await import("@/lib/domain-cache");

    await getCachedDomainIdentity("Example.COM", "eu-west-1");

    expect(mockReadCache).toHaveBeenCalledWith(
      "domain:identity:eu-west-1:example.com",
    );
    expect(mockGetDomainIdentity).toHaveBeenCalledWith("example.com", {
      region: "eu-west-1",
    });
    expect(mockWriteCache).toHaveBeenCalledWith(
      "domain:identity:eu-west-1:example.com",
      { verified: true, dkimStatus: "SUCCESS", dkimTokens: [] },
      120,
    );
  });

  it("defaults SES identity cache keys to us-east-1", async () => {
    const { getCachedDomainIdentity } = await import("@/lib/domain-cache");

    await getCachedDomainIdentity("example.com");

    expect(mockReadCache).toHaveBeenCalledWith(
      "domain:identity:us-east-1:example.com",
    );
    expect(mockGetDomainIdentity).toHaveBeenCalledWith("example.com", {
      region: "us-east-1",
    });
  });

  it("invalidates all supported regional SES identity cache keys when region is unknown", async () => {
    const { invalidateDomainIdentityCache } = await import(
      "@/lib/domain-cache"
    );

    await invalidateDomainIdentityCache("Example.COM");

    expect(mockDeleteCache).toHaveBeenCalledWith("domain:identity:example.com");
    expect(mockDeleteCache).toHaveBeenCalledWith(
      "domain:identity:us-east-1:example.com",
    );
    expect(mockDeleteCache).toHaveBeenCalledWith(
      "domain:identity:eu-west-1:example.com",
    );
    expect(mockDeleteCache).toHaveBeenCalledWith(
      "domain:identity:sa-east-1:example.com",
    );
    expect(mockDeleteCache).toHaveBeenCalledWith(
      "domain:identity:ap-northeast-1:example.com",
    );
  });
});
