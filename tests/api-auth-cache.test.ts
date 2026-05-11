import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.hoisted(() => vi.fn());
const mockDeleteCache = vi.hoisted(() => vi.fn());
const mockReadCache = vi.hoisted(() => vi.fn());
const mockWriteCache = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    update: vi.fn(),
    query: {
      apiKeys: {
        findFirst: mockFindFirst,
      },
    },
  },
}));

vi.mock("@/lib/cache/redis", () => ({
  deleteCache: mockDeleteCache,
  readCache: mockReadCache,
  writeCache: mockWriteCache,
}));

describe("api key auth cache", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("returns cached auth results without hitting the database", async () => {
    const rawKey = "os_cached";
    const tokenHash = createHash("sha256").update(rawKey).digest("hex");
    mockReadCache.mockResolvedValue({
      status: "hit",
      value: {
        apiKeyId: "key-1",
        permission: "full_access",
        domain: "example.com",
        userId: "user-1",
      },
    });

    const { validateApiKey } = await import("@/lib/api-auth");
    const result = await validateApiKey(`Bearer ${rawKey}`);

    expect(mockReadCache).toHaveBeenCalledWith(`auth:apikey:${tokenHash}`);
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(result).toEqual({
      apiKeyId: "key-1",
      permission: "full_access",
      domain: "example.com",
      userId: "user-1",
    });
  });

  it("falls back to the database on cache miss and writes the result back", async () => {
    const rawKey = "os_miss";
    const tokenHash = createHash("sha256").update(rawKey).digest("hex");
    mockReadCache.mockResolvedValue({ status: "miss", value: null });
    mockFindFirst.mockResolvedValue({
      id: "key-2",
      permission: "sending_access",
      domain: "example.com",
      userId: "user-2",
      lastUsedAt: null,
    });
    mockWriteCache.mockResolvedValue("written");

    const { validateApiKey } = await import("@/lib/api-auth");
    const result = await validateApiKey(`Bearer ${rawKey}`);

    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(mockWriteCache).toHaveBeenCalledWith(
      `auth:apikey:${tokenHash}`,
      {
        apiKeyId: "key-2",
        permission: "sending_access",
        domain: "example.com",
        userId: "user-2",
      },
      300,
    );
    expect(result).toEqual({
      apiKeyId: "key-2",
      permission: "sending_access",
      domain: "example.com",
      userId: "user-2",
    });
  });

  it("logs and falls back cleanly when redis is unavailable", async () => {
    mockReadCache.mockResolvedValue({ status: "unavailable", value: null });
    mockFindFirst.mockResolvedValue(null);

    const { validateApiKey } = await import("@/lib/api-auth");

    await expect(validateApiKey("Bearer os_unknown")).resolves.toBeNull();
    expect(mockFindFirst).toHaveBeenCalledOnce();
  });

  it("invalidates auth cache entries by token hash", async () => {
    mockDeleteCache.mockResolvedValue("deleted");

    const { invalidateApiKeyAuthCache } = await import("@/lib/api-auth");

    await invalidateApiKeyAuthCache("abc123");

    expect(mockDeleteCache).toHaveBeenCalledWith("auth:apikey:abc123");
  });
});
