import { readFileSync } from "node:fs";
import path from "node:path";
import { openApiDocument } from "@/lib/openapi";
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

const httpMethods = ["delete", "get", "patch", "post", "put"] as const;

const supportedRootAliasOperations = [
  "DELETE /api-keys/{id}",
  "DELETE /audiences/{audience_id}",
  "DELETE /broadcasts/{id}",
  "DELETE /contact-properties/{id}",
  "DELETE /contacts/{contact_id}",
  "DELETE /domains/{id}",
  "DELETE /segments/{id}",
  "DELETE /templates/{id}",
  "DELETE /topics/{id}",
  "DELETE /webhooks/{id}",
  "GET /api-keys",
  "GET /audiences",
  "GET /audiences/{audience_id}",
  "GET /broadcasts",
  "GET /broadcasts/{id}",
  "GET /contact-properties",
  "GET /contact-properties/{id}",
  "GET /contacts",
  "GET /contacts/{contact_id}",
  "GET /domains",
  "GET /domains/{id}",
  "GET /emails",
  "GET /emails/receiving",
  "GET /emails/receiving/{id}",
  "GET /emails/receiving/{id}/attachments",
  "GET /emails/receiving/{id}/attachments/{attachmentId}",
  "GET /emails/{id}",
  "GET /emails/{id}/attachments",
  "GET /emails/{id}/attachments/{attachmentId}",
  "GET /emails/{id}/events",
  "GET /emails/{id}/trace",
  "GET /logs",
  "GET /logs/{id}",
  "GET /segments",
  "GET /segments/{id}",
  "GET /segments/{id}/contacts",
  "GET /templates",
  "GET /templates/{id}",
  "GET /topics",
  "GET /topics/{id}",
  "GET /webhooks",
  "GET /webhooks/{id}",
  "PATCH /broadcasts/{id}",
  "PATCH /contact-properties/{id}",
  "PATCH /contacts/{contact_id}",
  "PATCH /domains/{id}",
  "PATCH /emails/{id}",
  "PATCH /templates/{id}",
  "PATCH /topics/{id}",
  "PATCH /webhooks/{id}",
  "POST /api-keys",
  "POST /audiences",
  "POST /broadcasts",
  "POST /broadcasts/{id}/send",
  "POST /contact-properties",
  "POST /contacts",
  "POST /domains",
  "POST /domains/{id}/verify",
  "POST /emails",
  "POST /emails/batch",
  "POST /emails/{email_id}/cancel",
  "POST /segments",
  "POST /templates",
  "POST /templates/{id}/duplicate",
  "POST /templates/{id}/publish",
  "POST /topics",
  "POST /webhooks",
] as const;

const unsupportedRootAliasPaths = [
  "/automations",
  "/automations/{id}",
  "/broadcasts/{id}/metrics",
  "/contacts/{contact_id}/segments",
  "/contacts/{contact_id}/segments/{segment_id}",
  "/contacts/{contact_id}/topics",
  "/domains/{id}/auto-configure",
  "/events",
  "/events/send",
] as const;

function rootOperationAllowlist() {
  return Object.entries(openApiDocument.paths)
    .filter(([pathKey]) => !pathKey.startsWith("/api/"))
    .flatMap(([pathKey, pathItem]) =>
      httpMethods
        .filter((method) => method in pathItem)
        .map((method) => `${method.toUpperCase()} ${pathKey}`),
    )
    .sort();
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
    expect(document.paths).toHaveProperty("/emails/{email_id}/cancel");
    expect(document.paths).toHaveProperty("/api/domains");
    expect(serialized).not.toMatch(
      /AWS_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|CLOUDFLARE|DATABASE_URL/i,
    );
    expect(serialized).not.toMatch(/sk_(live|test)_[A-Za-z0-9]+/);
    expect(serialized).not.toMatch(/os_(?!xxx)[A-Za-z0-9]{12,}/);
  });

  it("documents exactly the implemented root-compatible alias operations", () => {
    expect(rootOperationAllowlist()).toEqual(supportedRootAliasOperations);
    expect(new Set(rootOperationAllowlist()).size).toBe(
      supportedRootAliasOperations.length,
    );

    for (const unsupportedPath of unsupportedRootAliasPaths) {
      expect(openApiDocument.paths).not.toHaveProperty(unsupportedPath);
    }
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
    expect(docsPage).toContain("OpenAPI");
    expect(docsPage).toContain("/emails/:email_id/cancel");
  });
});
