// E2E category: provider-gated API E2E; live Stripe checkout requires explicit billing env prerequisites.
import { expect, test } from "@playwright/test";

const sessionCookie = process.env.BILLING_E2E_SESSION_COOKIE;
const planId = process.env.BILLING_E2E_PLAN_ID;
const canRunStripeCheckoutE2E =
  process.env.BILLING_BACKEND === "stripe" &&
  Boolean(process.env.STRIPE_SECRET_KEY) &&
  Boolean(sessionCookie) &&
  Boolean(planId);

test.describe("Billing checkout endpoint", () => {
  test.skip(
    !canRunStripeCheckoutE2E,
    "Set BILLING_BACKEND=stripe, STRIPE_SECRET_KEY, BILLING_E2E_SESSION_COOKIE, and BILLING_E2E_PLAN_ID to run live Stripe checkout E2E.",
  );

  test("returns a Stripe Checkout URL", async ({ request }) => {
    const response = await request.post("/api/billing/checkout", {
      headers: { cookie: sessionCookie ?? "" },
      data: { plan_id: planId },
    });

    expect(response.ok()).toBe(true);
    const body = (await response.json()) as { url?: string };
    expect(body.url).toBeTruthy();
    expect(new URL(body.url ?? "").hostname).toBe("checkout.stripe.com");
  });
});
