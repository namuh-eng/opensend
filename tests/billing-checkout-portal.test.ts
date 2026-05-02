import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetServerSession = vi.fn();
const mockPlanFindById = vi.fn();
const mockFindCustomerByUserId = vi.fn();
const mockEnsureCustomerForUser = vi.fn();
const mockStripeCustomerCreate = vi.fn();
const mockCheckoutCreate = vi.fn();
const mockPortalCreate = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("@namuh/core", () => ({
  planRepo: {
    findById: mockPlanFindById,
  },
  stripeCustomerRepo: {
    findByUserId: mockFindCustomerByUserId,
    ensureForUser: mockEnsureCustomerForUser,
  },
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    customers: { create: mockStripeCustomerCreate },
    checkout: { sessions: { create: mockCheckoutCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
  }),
}));

const testSession = {
  user: {
    id: "user_123",
    email: "owner@example.com",
    name: "Owner Example",
  },
};

function postRequest(path: string, body?: unknown) {
  return new Request(`https://app.opensend.test${path}`, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
  });
}

async function importCheckoutRoute() {
  return await import("@/app/api/billing/checkout/route");
}

async function importPortalRoute() {
  return await import("@/app/api/billing/portal/route");
}

describe("billing checkout and portal routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.BILLING_BACKEND = "stripe";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    mockGetServerSession.mockResolvedValue(testSession);
  });

  it("returns 404 when Stripe billing is disabled instead of throwing", async () => {
    process.env.BILLING_BACKEND = undefined;
    process.env.STRIPE_SECRET_KEY = undefined;
    const { POST } = await importCheckoutRoute();

    const response = await POST(
      postRequest("/api/billing/checkout", { plan_id: "plan_1" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Billing is not enabled",
    });
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });

  it("auto-creates a Stripe customer and returns the checkout session URL", async () => {
    mockPlanFindById.mockResolvedValue({
      id: "plan_pro",
      isPublic: true,
      stripePriceId: "price_123",
    });
    mockFindCustomerByUserId.mockResolvedValue(undefined);
    mockStripeCustomerCreate.mockResolvedValue({ id: "cus_new" });
    mockEnsureCustomerForUser.mockResolvedValue({
      userId: "user_123",
      stripeCustomerId: "cus_new",
    });
    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    const { POST } = await importCheckoutRoute();

    const response = await POST(
      postRequest("/api/billing/checkout", { plan_id: "plan_pro" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
    expect(mockStripeCustomerCreate).toHaveBeenCalledWith({
      email: "owner@example.com",
      name: "Owner Example",
      metadata: { user_id: "user_123" },
    });
    expect(mockEnsureCustomerForUser).toHaveBeenCalledWith(
      "user_123",
      "cus_new",
    );
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        line_items: [{ price: "price_123", quantity: 1 }],
        mode: "subscription",
        success_url:
          "https://app.opensend.test/settings/billing?status=success",
        cancel_url:
          "https://app.opensend.test/settings/billing?status=cancelled",
      }),
    );
  });

  it("returns a checkout URL for an existing Stripe customer", async () => {
    mockPlanFindById.mockResolvedValue({
      id: "plan_pro",
      isPublic: true,
      stripePriceId: "price_123",
    });
    mockFindCustomerByUserId.mockResolvedValue({
      userId: "user_123",
      stripeCustomerId: "cus_existing",
    });
    mockCheckoutCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_existing",
    });
    const { POST } = await importCheckoutRoute();

    const response = await POST(
      postRequest("/api/billing/checkout", { planId: "plan_pro" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_existing",
    });
    expect(mockStripeCustomerCreate).not.toHaveBeenCalled();
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("reuses the current user's Stripe customer for the customer portal", async () => {
    mockFindCustomerByUserId.mockResolvedValue({
      userId: "user_123",
      stripeCustomerId: "cus_existing",
    });
    mockPortalCreate.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_123",
    });
    const { POST } = await importPortalRoute();

    const response = await POST(postRequest("/api/billing/portal"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/p/session/test_123",
    });
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://app.opensend.test/settings/billing",
    });
  });
});
