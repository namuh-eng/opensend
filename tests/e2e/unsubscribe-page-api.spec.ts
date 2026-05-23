import { expect, test } from "@playwright/test";

/**
 * E2E tests for the /api/unsubscribe-page route.
 *
 * These tests exercise the HTTP layer directly. They follow the same
 * unauthenticated-guard pattern as dedicated-ips-api.spec.ts.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3015";

test.describe("GET /api/unsubscribe-page — unauthenticated", () => {
  test("returns 401 when no Authorization header is provided", async ({
    request,
  }) => {
    const res = await request.get(`${BASE_URL}/api/unsubscribe-page`);
    expect(res.status()).toBe(401);
  });

  test("returns 401 with a malformed API key", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/unsubscribe-page`, {
      headers: { Authorization: "Bearer not-a-real-key" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("PUT /api/unsubscribe-page — unauthenticated", () => {
  test("returns 401 when no Authorization header is provided", async ({
    request,
  }) => {
    const res = await request.put(`${BASE_URL}/api/unsubscribe-page`, {
      data: { headline: "Test" },
    });
    expect(res.status()).toBe(401);
  });

  test("returns 401 with a malformed API key", async ({ request }) => {
    const res = await request.put(`${BASE_URL}/api/unsubscribe-page`, {
      headers: { Authorization: "Bearer not-a-real-key" },
      data: { headline: "Test" },
    });
    expect(res.status()).toBe(401);
  });
});
