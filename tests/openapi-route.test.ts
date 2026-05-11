import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mockGetSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: mockGetSessionCookie,
}));

function makeRequest(url: string, init?: RequestInit): NextRequest {
  const request = new Request(url, init) as Request & { nextUrl: URL };
  request.nextUrl = new URL(url);
  return request as unknown as NextRequest;
}

describe("GET /openapi.json", () => {
  it("returns unauthenticated OpenAPI 3.x JSON with required public paths and no secrets", async () => {
    const { GET } = await import("@/app/openapi.json/route");

    const response = GET();
    const document = (await response.json()) as {
      openapi?: string;
      info?: { title?: string };
      components?: {
        securitySchemes?: Record<string, unknown>;
        schemas?: Record<string, unknown>;
        parameters?: Record<string, { schema?: Record<string, unknown> }>;
      };
      paths?: Record<string, unknown>;
    };
    const serialized = JSON.stringify(document);

    expect(response.status).toBe(200);
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info?.title).toBe("OpenSend API");
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(document.components?.schemas?.ErrorEnvelope).toMatchObject({
      type: "object",
      required: ["name", "code", "message", "statusCode"],
    });
    expect(
      document.components?.parameters?.IdempotencyKey?.schema,
    ).toMatchObject({
      minLength: 1,
      maxLength: 256,
    });
    expect(document.paths).toHaveProperty("/emails");
    expect(document.paths).toHaveProperty("/emails/batch");
    expect(document.paths).toHaveProperty("/api/domains");
    expect(serialized).not.toMatch(
      /AWS_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|CLOUDFLARE|DATABASE_URL/i,
    );
    expect(serialized).not.toMatch(/sk_(live|test)_[A-Za-z0-9]+/);
    expect(serialized).not.toMatch(/os_(?!xxx)[A-Za-z0-9]{12,}/);
  });

  it("is not redirected by middleware without a dashboard session", async () => {
    mockGetSessionCookie.mockReturnValue(null);
    process.env.RATE_LIMIT_BACKEND = "disabled";
    const { middleware } = await import("@/middleware");

    const response = await middleware(
      makeRequest("https://example.com/openapi.json", { method: "GET" }),
    );

    expect(mockGetSessionCookie).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("links the docs surface to the OpenAPI contract", () => {
    const docsPage = readFileSync(
      path.join(process.cwd(), "src/app/docs/page.tsx"),
      "utf8",
    );

    expect(docsPage).toContain('href="/openapi.json"');
    expect(docsPage).toContain("OpenAPI 3.0 JSON");
  });
});
