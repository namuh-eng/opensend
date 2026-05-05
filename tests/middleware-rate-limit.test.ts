import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsRedisConfigured = vi.hoisted(() => vi.fn());
const mockIncrCache = vi.hoisted(() => vi.fn());
const mockGetTtl = vi.hoisted(() => vi.fn());
const mockGetSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cache/redis", () => ({
  isRedisConfigured: mockIsRedisConfigured,
  incrCache: mockIncrCache,
  getTtl: mockGetTtl,
}));

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: mockGetSessionCookie,
}));

function makeRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as unknown as NextRequest;
}

describe("middleware rate limiting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockGetSessionCookie.mockReturnValue("session");
    mockIsRedisConfigured.mockReturnValue(true);
    process.env.RATE_LIMIT_BACKEND = "disabled";
  });

  it("skips API rate limiting when RATE_LIMIT_BACKEND is disabled", async () => {
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/api/emails", { method: "POST" }),
    );

    expect(mockIncrCache).not.toHaveBeenCalled();
    expect(response.headers.get("x-ratelimit-backend")).toBe("disabled");
  });

  it("enforces Redis-backed limits for API routes", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/api/emails", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/emails",
      60,
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
  });

  it("returns 429 with Retry-After once the Redis limit is exceeded", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockIncrCache.mockResolvedValue(21);
    mockGetTtl.mockResolvedValue(17);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/api/emails", { method: "POST" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
    await expect(response.json()).resolves.toEqual({
      name: "rate_limit_exceeded",
      code: "rate_limit_exceeded",
      message: "Rate limit exceeded. Try again later.",
      statusCode: 429,
    });
  });

  it("returns 503 when Redis-backed rate limiting is unavailable", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockIncrCache.mockResolvedValue(null);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/api/emails", { method: "POST" }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
    await expect(response.json()).resolves.toEqual({
      name: "rate_limit_unavailable",
      code: "rate_limit_unavailable",
      message: "Rate limiting is temporarily unavailable.",
      statusCode: 503,
    });
  });
});
