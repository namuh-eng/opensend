import { expect, test } from "@playwright/test";

/**
 * E2E tests for the /api/dedicated-ips route.
 * These tests do not need a running dev server beyond the standard test setup
 * because they exercise the HTTP layer directly.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3015";

test.describe("GET /api/dedicated-ips — unauthenticated", () => {
  test("returns 401 when no Authorization header is provided", async ({
    request,
  }) => {
    const res = await request.get(`${BASE_URL}/api/dedicated-ips`);
    expect(res.status()).toBe(401);
  });

  test("returns 401 with a malformed API key", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/dedicated-ips`, {
      headers: { Authorization: "Bearer not-a-real-key" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("POST /api/dedicated-ips — unauthenticated", () => {
  test("returns 401 when no Authorization header is provided", async ({
    request,
  }) => {
    const res = await request.post(`${BASE_URL}/api/dedicated-ips`, {
      data: { name: "My Pool", ses_pool_name: "my-ses-pool" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("GET /api/dedicated-ips/{id} — unauthenticated", () => {
  test("returns 401 when no Authorization header is provided", async ({
    request,
  }) => {
    const res = await request.get(
      `${BASE_URL}/api/dedicated-ips/00000000-0000-0000-0000-000000000001`,
    );
    expect(res.status()).toBe(401);
  });
});

test.describe("DELETE /api/dedicated-ips/{id} — unauthenticated", () => {
  test("returns 401 when no Authorization header is provided", async ({
    request,
  }) => {
    const res = await request.delete(
      `${BASE_URL}/api/dedicated-ips/00000000-0000-0000-0000-000000000001`,
    );
    expect(res.status()).toBe(401);
  });
});
