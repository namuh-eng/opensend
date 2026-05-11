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

  it("rewrites POST /emails to the existing send API without requiring a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/emails", {
        method: "POST",
        headers: {
          authorization: "Bearer test-api-key",
          "content-type": "application/json",
          "idempotency-key": "alias-key",
        },
        body: JSON.stringify({
          from: "sender@example.com",
          to: "recipient@example.com",
          subject: "Alias",
          html: "<p>Hello</p>",
        }),
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/emails",
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("disabled");
  });

  it("rewrites POST /emails/batch to the existing batch API without requiring a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/emails/batch", {
        method: "POST",
        headers: {
          authorization: "Bearer test-api-key",
          "content-type": "application/json",
          "idempotency-key": "batch-alias-key",
        },
        body: JSON.stringify([
          {
            from: "sender@example.com",
            to: "recipient@example.com",
            subject: "Batch alias",
            html: "<p>Hello</p>",
          },
        ]),
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/emails/batch",
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("disabled");
  });

  it("preserves dashboard GET /emails/batch session protection", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/emails/batch", { method: "GET" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/auth");
  });

  it("preserves dashboard GET /emails session protection", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/emails", { method: "GET" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/auth");
  });

  it("allows root contacts API aliases without requiring a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/contacts/user@example.com", {
        method: "PATCH",
        headers: { authorization: "Bearer test-api-key" },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.status).not.toBe(307);
    expect(response.headers.get("x-ratelimit-backend")).toBe("disabled");
  });

  it("allows root audiences API aliases without requiring a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/audiences/aud_123", {
        method: "DELETE",
        headers: { authorization: "Bearer test-api-key" },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.status).not.toBe(307);
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

  it("applies the strict send rate-limit bucket to POST /emails", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/emails", {
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
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/emails",
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
  });

  it("applies the batch send rate-limit bucket to POST /emails/batch", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/emails/batch", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/emails/batch",
      60,
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/emails/batch",
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
  });

  it("shares rate-limit buckets between root contacts aliases and /api/contacts", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/contacts/user@example.com", {
        method: "DELETE",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/contacts/user@example.com",
      60,
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
  });

  it("shares rate-limit buckets between root audiences aliases and /api/segments", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/audiences/aud_123", {
        method: "DELETE",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/segments/aud_123",
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

  it("returns send API-style JSON rate-limit errors for POST /emails", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(21);
    mockGetTtl.mockResolvedValue(17);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/emails", { method: "POST" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      name: "rate_limit_exceeded",
      code: "rate_limit_exceeded",
      message: "Rate limit exceeded. Try again later.",
      statusCode: 429,
    });
  });

  it("returns send API-style JSON rate-limit errors for POST /emails/batch", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(6);
    mockGetTtl.mockResolvedValue(17);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/emails/batch", { method: "POST" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
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
