import { getBillingBackend, isBillingEnabled } from "@/lib/billing";
import { describe, expect, it } from "vitest";

describe("getBillingBackend()", () => {
  it("returns 'disabled' when BILLING_BACKEND is unset", () => {
    expect(getBillingBackend({})).toBe("disabled");
    expect(isBillingEnabled({})).toBe(false);
  });

  it("returns 'disabled' when BILLING_BACKEND is the literal 'disabled'", () => {
    expect(getBillingBackend({ BILLING_BACKEND: "disabled" })).toBe("disabled");
  });

  it("returns 'disabled' when BILLING_BACKEND=stripe but the secret key is missing", () => {
    expect(getBillingBackend({ BILLING_BACKEND: "stripe" })).toBe("disabled");
    expect(
      getBillingBackend({ BILLING_BACKEND: "stripe", STRIPE_SECRET_KEY: "" }),
    ).toBe("disabled");
    expect(
      getBillingBackend({
        BILLING_BACKEND: "stripe",
        STRIPE_SECRET_KEY: "   ",
      }),
    ).toBe("disabled");
  });

  it("returns 'stripe' when BILLING_BACKEND=stripe and STRIPE_SECRET_KEY is present", () => {
    expect(
      getBillingBackend({
        BILLING_BACKEND: "stripe",
        STRIPE_SECRET_KEY: "sk_test_123",
      }),
    ).toBe("stripe");
    expect(
      isBillingEnabled({
        BILLING_BACKEND: "stripe",
        STRIPE_SECRET_KEY: "sk_test_123",
      }),
    ).toBe(true);
  });

  it("normalises whitespace and case on the BILLING_BACKEND value", () => {
    expect(
      getBillingBackend({
        BILLING_BACKEND: " STRIPE ",
        STRIPE_SECRET_KEY: "sk_test_123",
      }),
    ).toBe("stripe");
  });

  it("treats unknown backend values as disabled", () => {
    expect(
      getBillingBackend({
        BILLING_BACKEND: "lemonsqueezy",
        STRIPE_SECRET_KEY: "sk_test_123",
      }),
    ).toBe("disabled");
  });
});
