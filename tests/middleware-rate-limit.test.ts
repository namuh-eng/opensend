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

  it("allows the public status page without a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/status", {
        method: "GET",
        headers: { accept: "text/html" },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
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

  it("lets POST /emails/:id/cancel reach the root API route without requiring a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/emails/email_123/cancel", {
        method: "POST",
        headers: { authorization: "Bearer test-api-key" },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
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

  it("rewrites explicit API GET aliases for dashboard-colliding resources", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const cases = [
      ["/domains", "/api/domains"],
      ["/domains/domain_123", "/api/domains/domain_123"],
      ["/webhooks", "/api/webhooks"],
      ["/webhooks/webhook_123", "/api/webhooks/webhook_123"],
      ["/logs", "/api/logs"],
      ["/logs/log_123", "/api/logs/log_123"],
      ["/emails", "/api/emails"],
      ["/emails/email_123", "/api/emails/email_123"],
      ["/emails/email_123/events", "/api/emails/email_123/events"],
      ["/emails/email_123/trace", "/api/emails/email_123/trace"],
      ["/emails/email_123/attachments", "/api/emails/email_123/attachments"],
      [
        "/emails/email_123/attachments/attachment_123",
        "/api/emails/email_123/attachments/attachment_123",
      ],
      ["/emails/receiving", "/api/emails/receiving"],
      ["/emails/receiving/email_123", "/api/emails/receiving/email_123"],
      [
        "/emails/receiving/email_123/attachments",
        "/api/emails/receiving/email_123/attachments",
      ],
      [
        "/emails/receiving/email_123/attachments/attachment_123",
        "/api/emails/receiving/email_123/attachments/attachment_123",
      ],
    ] as const;

    for (const [aliasPath, apiPath] of cases) {
      const response = await middleware(
        makeRequest(`https://example.com${aliasPath}`, {
          method: "GET",
          headers: {
            accept: "application/json",
            authorization: "Bearer test-api-key",
          },
        }),
      );

      expect(response.headers.get("x-middleware-rewrite")).toBe(
        `https://example.com${apiPath}`,
      );
    }

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
  });

  it("preserves browser dashboard GETs instead of rewriting compatibility aliases", async () => {
    const { middleware } = await import("@/middleware");

    for (const aliasPath of ["/domains", "/webhooks", "/logs", "/emails"]) {
      const response = await middleware(
        makeRequest(`https://example.com${aliasPath}`, {
          method: "GET",
          headers: { accept: "text/html" },
        }),
      );

      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }

    expect(mockGetSessionCookie).toHaveBeenCalled();
  });

  it("rewrites mutation aliases for implemented API resources", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const cases = [
      ["POST", "/domains", "/api/domains"],
      ["PATCH", "/domains/domain_123", "/api/domains/domain_123"],
      ["POST", "/domains/domain_123/verify", "/api/domains/domain_123/verify"],
      ["POST", "/webhooks", "/api/webhooks"],
      ["DELETE", "/webhooks/webhook_123", "/api/webhooks/webhook_123"],
      ["POST", "/topics", "/api/topics"],
      ["PATCH", "/topics/topic_123", "/api/topics/topic_123"],
      ["POST", "/contact-properties", "/api/properties"],
      ["DELETE", "/contact-properties/prop_123", "/api/properties/prop_123"],
      ["PATCH", "/emails/email_123", "/api/emails/email_123"],
    ] as const;

    for (const [method, aliasPath, apiPath] of cases) {
      const response = await middleware(
        makeRequest(`https://example.com${aliasPath}`, {
          method,
          headers: {
            authorization: "Bearer test-api-key",
            "content-type": "application/json",
          },
        }),
      );

      expect(response.headers.get("x-middleware-rewrite")).toBe(
        `https://example.com${apiPath}`,
      );
    }

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
  });

  it("shares rate-limit buckets between compatibility aliases and canonical API routes", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/domains", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
          "content-type": "application/json",
        },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/domains",
      60,
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/domains",
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
  });

  it("preserves browser/RSC dashboard GET /broadcasts instead of rewriting the API alias", async () => {
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/broadcasts", {
        method: "GET",
        headers: {
          accept: "*/*",
          rsc: "1",
          "next-router-state-tree": encodeURIComponent("[]"),
          "next-url": "/broadcasts",
        },
      }),
    );

    expect(mockGetSessionCookie).toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated browser/RSC GET /broadcasts to auth instead of the API alias", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/broadcasts", {
        method: "GET",
        headers: {
          accept: "*/*",
          rsc: "1",
          "next-router-state-tree": encodeURIComponent("[]"),
          "next-url": "/broadcasts",
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/auth");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites explicit API GET /broadcasts clients to the Resend-compatible alias", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/broadcasts", {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/broadcasts",
    );
    expect(response.headers.get("x-ratelimit-backend")).toBe("disabled");
  });

  it("preserves browser/RSC dashboard GET /api-keys instead of rewriting the root API alias", async () => {
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/api-keys", {
        method: "GET",
        headers: {
          accept: "*/*",
          rsc: "1",
          "next-router-state-tree": encodeURIComponent("[]"),
          "next-url": "/api-keys",
        },
      }),
    );

    expect(mockGetSessionCookie).toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("rewrites root /api-keys API clients to the existing API key routes", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const list = await middleware(
      makeRequest("https://example.com/api-keys", {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer test-api-key",
        },
      }),
    );
    const create = await middleware(
      makeRequest("https://example.com/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    const deleteResponse = await middleware(
      makeRequest("https://example.com/api-keys/key_123", {
        method: "DELETE",
        headers: { authorization: "Bearer test-api-key" },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(list.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/api-keys",
    );
    expect(create.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/api-keys",
    );
    expect(deleteResponse.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/api-keys/key_123",
    );
  });

  it("preserves browser/RSC dashboard GET /templates instead of rewriting the root API alias", async () => {
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/templates", {
        method: "GET",
        headers: {
          accept: "*/*",
          rsc: "1",
          "next-router-state-tree": encodeURIComponent("[]"),
          "next-url": "/templates",
        },
      }),
    );

    expect(mockGetSessionCookie).toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated browser/RSC GET /templates to auth instead of the root API alias", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/templates", {
        method: "GET",
        headers: {
          accept: "*/*",
          rsc: "1",
          "next-router-state-tree": encodeURIComponent("[]"),
          "next-url": "/templates",
        },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/auth");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rewrites explicit root /templates API clients to strict public template adapters", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    const { middleware } = await import("@/middleware");

    const collection = await middleware(
      makeRequest("https://example.com/templates", {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer test-api-key",
        },
      }),
    );
    const detail = await middleware(
      makeRequest("https://example.com/templates/welcome", {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer test-api-key",
        },
      }),
    );
    const mutation = await middleware(
      makeRequest("https://example.com/templates/welcome/publish", {
        method: "POST",
        headers: { authorization: "Bearer test-api-key" },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(collection.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/public/templates",
    );
    expect(detail.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/public/templates/welcome",
    );
    expect(mutation.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/public/templates/welcome/publish",
    );
  });

  it("preserves browser dashboard GET /templates/:id detail routes", async () => {
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/templates/welcome", {
        method: "GET",
        headers: { accept: "text/html" },
      }),
    );

    expect(mockGetSessionCookie).toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
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

  it("shares rate-limit buckets between root email cancel aliases and /api/emails", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/emails/email_123/cancel", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/emails/email_123/cancel",
      60,
    );
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
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

  it("lets root segments aliases reach API routes without dashboard session redirects", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/segments/seg_123/contacts", {
        method: "GET",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/segments/seg_123/contacts",
      60,
    );
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-ratelimit-backend")).toBe("redis");
  });

  it("shares tight rate-limit buckets between root API-key aliases and /api/api-keys", async () => {
    process.env.RATE_LIMIT_BACKEND = "redis";
    mockGetSessionCookie.mockReturnValue(null);
    mockIncrCache.mockResolvedValue(1);

    const { middleware } = await import("@/middleware");
    const response = await middleware(
      makeRequest("https://example.com/api-keys/key_123", {
        method: "DELETE",
        headers: {
          "x-forwarded-for": "203.0.113.10",
          authorization: "Bearer test-api-key",
        },
      }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(mockIncrCache).toHaveBeenCalledWith(
      "ratelimit:203.0.113.10:Bearer test-api-key:/api/api-keys/key_123",
      60,
    );
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://example.com/api/api-keys/key_123",
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
