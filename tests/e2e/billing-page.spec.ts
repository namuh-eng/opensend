// E2E category: provider-gated/mocked integration; Stripe paths are skipped or route-mocked unless billing env is configured.
import { expect, test } from "@playwright/test";

const billingBackend = process.env.BILLING_BACKEND?.toLowerCase() ?? "disabled";
const billingEnabled =
  billingBackend === "stripe" && Boolean(process.env.STRIPE_SECRET_KEY);

test.describe("Billing — disabled (self-host default)", () => {
  test.skip(billingEnabled, "Only runs when billing is disabled");

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "billing-disabled-e2e-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  });

  test("/settings/billing returns 404", async ({ page }) => {
    const response = await page.goto("/settings/billing");
    expect(response?.status()).toBe(404);
  });

  test("/pricing returns 404", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.status()).toBe(404);
  });

  test("/api/billing/checkout returns 404 without billing backend", async ({
    request,
  }) => {
    const response = await request.post("/api/billing/checkout", {
      data: { plan_id: "any" },
    });
    expect(response.status()).toBe(404);
  });

  test("/api/billing/portal returns 404 without billing backend", async ({
    request,
  }) => {
    const response = await request.post("/api/billing/portal", { data: {} });
    expect(response.status()).toBe(404);
  });
});

test.describe("Billing — enabled (Stripe)", () => {
  test.skip(
    !billingEnabled,
    "Requires BILLING_BACKEND=stripe + STRIPE_SECRET_KEY",
  );

  test("dashboard → pricing → checkout redirect lands on checkout.stripe.com", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.route("**/api/auth/get-session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: { id: "e2e-session", token: "e2e-session-token" },
          user: { id: "e2e-user", email: "e2e@example.com", name: "E2E User" },
        }),
      });
    });

    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://checkout.stripe.com/c/pay/cs_test_123",
        }),
      });
    });

    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Plans" })).toBeVisible();

    const upgradeButton = page
      .locator('[data-testid$="-upgrade"]:not([disabled])')
      .first();
    await expect(upgradeButton).toBeVisible();

    const navigationPromise = page.waitForURL(/checkout\.stripe\.com/);
    await upgradeButton.click();
    await navigationPromise;

    expect(page.url()).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});
