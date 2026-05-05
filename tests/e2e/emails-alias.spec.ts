import { expect, test } from "@playwright/test";

test.describe("Resend-compatible /emails alias", () => {
  test("POST /emails reaches the JSON send API instead of dashboard routing", async ({
    request,
  }) => {
    const response = await request.post("/emails", {
      headers: {
        Authorization: "Basic invalid_key",
        "Content-Type": "application/json",
        "Idempotency-Key": "alias-e2e-invalid-key",
      },
      data: {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Alias",
        html: "<p>Hello</p>",
      },
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    const json = await response.json();
    expect(json).toMatchObject({
      name: "malformed_api_key",
      code: "malformed_api_key",
      statusCode: 401,
    });
  });

  test("POST /emails/batch reaches the JSON batch API instead of dashboard routing", async ({
    request,
  }) => {
    const response = await request.post("/emails/batch", {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "batch-alias-e2e-missing-key",
      },
      data: [
        {
          from: "sender@example.com",
          to: "recipient@example.com",
          subject: "Batch alias",
          html: "<p>Hello</p>",
        },
      ],
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers().location).toBeUndefined();
    const json = await response.json();
    expect(json).toMatchObject({
      name: "missing_api_key",
      code: "missing_api_key",
      statusCode: 401,
    });
  });

  test("GET /emails keeps the dashboard sign-in flow", async ({ page }) => {
    await page.goto("/emails");

    await expect(page).toHaveURL(/\/auth/);
  });
});
