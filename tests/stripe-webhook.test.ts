import {
  type ParsedStripeInvoice,
  generateStripeSignatureHeader,
} from "@namuh/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StripeWebhookProcessor } from "../packages/ingester/src/stripe-webhook";

const secret = "whsec_test_secret";

type StripeFixture = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

async function signedFixture(fixture: StripeFixture): Promise<{
  rawBody: string;
  signatureHeader: string;
}> {
  const rawBody = JSON.stringify(fixture);
  const signatureHeader = await generateStripeSignatureHeader({
    payload: rawBody,
    secret,
    timestamp: Math.floor(Date.now() / 1000),
  });
  return { rawBody, signatureHeader };
}

function createProcessor(overrides?: {
  markProcessed?: (
    eventId: string,
    type: string,
  ) => Promise<{ created: boolean }>;
  findSubscription?: (
    stripeSubscriptionId: string,
  ) => Promise<{ id: string; userId: string; status: string } | null>;
  emailNotifier?: (input: {
    to: string;
    userId: string;
    invoice: ParsedStripeInvoice;
  }) => Promise<void>;
  resolveUserEmail?: (userId: string) => Promise<string | null>;
}) {
  const calls = {
    markProcessed: vi.fn(
      overrides?.markProcessed ??
        (async () => ({
          created: true,
        })),
    ),
    deleteProcessed: vi.fn(async () => {}),
    ensureForUser: vi.fn(async () => ({})),
    findCustomer: vi.fn(async () => ({ userId: "user-1" })),
    listPlans: vi.fn(async () => [
      { id: "plan-pro", stripePriceId: "price_pro" },
      { id: "plan-free", stripePriceId: null },
    ]),
    ensureFreePlan: vi.fn(async () => ({ id: "plan-free" })),
    findSubscription: vi.fn(
      overrides?.findSubscription ??
        (async () => ({
          id: "sub-local-1",
          userId: "user-1",
          status: "past_due",
        })),
    ),
    updateSubscription: vi.fn(async () => ({})),
    upsertSubscription: vi.fn(async () => ({})),
    emailNotifier: vi.fn(overrides?.emailNotifier ?? (async () => {})),
    resolveUserEmail: vi.fn(
      overrides?.resolveUserEmail ?? (async () => "owner@example.com"),
    ),
    log: vi.fn(),
  };

  const processor = new StripeWebhookProcessor({
    secret,
    notificationFrom: "billing@example.com",
    deps: {
      stripeEventStore: {
        markProcessed: calls.markProcessed,
        deleteProcessed: calls.deleteProcessed,
      },
      stripeCustomerStore: {
        ensureForUser: calls.ensureForUser,
        findByStripeCustomerId: calls.findCustomer,
      },
      planStore: {
        list: calls.listPlans,
        ensureFreePlan: calls.ensureFreePlan,
      },
      subscriptionStore: {
        findByStripeSubscriptionId: calls.findSubscription,
        update: calls.updateSubscription,
        upsertByUserId: calls.upsertSubscription,
      },
      emailNotifier: calls.emailNotifier,
      resolveUserEmail: calls.resolveUserEmail,
      log: calls.log,
    },
  });

  return { processor, calls };
}

const subscriptionObject = {
  id: "sub_stripe_1",
  status: "active",
  customer: "cus_123",
  current_period_start: 1_776_000_000,
  current_period_end: 1_778_592_000,
  cancel_at_period_end: false,
  items: { data: [{ price: { id: "price_pro" } }] },
};

const invoiceObject = {
  id: "in_123",
  customer: "cus_123",
  subscription: "sub_stripe_1",
  hosted_invoice_url: "https://billing.stripe.test/in_123",
  amount_due: 2900,
  status: "open",
};

describe("StripeWebhookProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsigned or forged webhook payloads", async () => {
    const { processor, calls } = createProcessor();
    const fixture = await signedFixture({
      id: "evt_bad",
      type: "customer.subscription.updated",
      data: { object: subscriptionObject },
    });

    const outcome = await processor.process({
      rawBody: fixture.rawBody,
      signatureHeader: "t=1,v1=forged",
    });

    expect(outcome).toMatchObject({
      status: "rejected",
      httpStatus: 400,
    });
    expect(calls.markProcessed).not.toHaveBeenCalled();
  });

  it("dedupes replayed events before applying subscription side effects", async () => {
    const { processor, calls } = createProcessor({
      markProcessed: async () => ({ created: false }),
    });
    const fixture = await signedFixture({
      id: "evt_duplicate",
      type: "customer.subscription.updated",
      data: { object: subscriptionObject },
    });

    const outcome = await processor.process(fixture);

    expect(outcome).toEqual({
      status: "duplicate",
      eventId: "evt_duplicate",
      type: "customer.subscription.updated",
    });
    expect(calls.updateSubscription).not.toHaveBeenCalled();
    expect(calls.upsertSubscription).not.toHaveBeenCalled();
  });

  it("records checkout.session.completed customer ownership", async () => {
    const { processor, calls } = createProcessor();
    const fixture = await signedFixture({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_stripe_1",
          client_reference_id: "user-1",
          metadata: {},
        },
      },
    });

    const outcome = await processor.process(fixture);

    expect(outcome.status).toBe("processed");
    expect(calls.ensureForUser).toHaveBeenCalledWith("user-1", "cus_123");
  });

  it("creates a local subscription for customer.subscription.created", async () => {
    const { processor, calls } = createProcessor({
      findSubscription: async () => null,
    });
    const fixture = await signedFixture({
      id: "evt_sub_created",
      type: "customer.subscription.created",
      data: { object: subscriptionObject },
    });

    const outcome = await processor.process(fixture);

    expect(outcome.status).toBe("processed");
    expect(calls.upsertSubscription).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        planId: "plan-pro",
        status: "active",
        stripeSubscriptionId: "sub_stripe_1",
      }),
    );
  });

  it("updates status for customer.subscription.updated", async () => {
    const { processor, calls } = createProcessor();
    const fixture = await signedFixture({
      id: "evt_sub_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          ...subscriptionObject,
          status: "past_due",
        },
      },
    });

    const outcome = await processor.process(fixture);

    expect(outcome.status).toBe("processed");
    expect(calls.updateSubscription).toHaveBeenCalledWith(
      "sub-local-1",
      expect.objectContaining({
        status: "past_due",
        stripeSubscriptionId: "sub_stripe_1",
      }),
    );
  });

  it("marks customer.subscription.deleted as canceled", async () => {
    const { processor, calls } = createProcessor();
    const fixture = await signedFixture({
      id: "evt_sub_deleted",
      type: "customer.subscription.deleted",
      data: { object: { ...subscriptionObject, status: "canceled" } },
    });

    const outcome = await processor.process(fixture);

    expect(outcome.status).toBe("processed");
    expect(calls.updateSubscription).toHaveBeenCalledWith(
      "sub-local-1",
      expect.objectContaining({ status: "canceled" }),
    );
  });

  it("marks invoice.paid subscriptions active", async () => {
    const { processor, calls } = createProcessor();
    const fixture = await signedFixture({
      id: "evt_invoice_paid",
      type: "invoice.paid",
      data: { object: invoiceObject },
    });

    const outcome = await processor.process(fixture);

    expect(outcome.status).toBe("processed");
    expect(calls.updateSubscription).toHaveBeenCalledWith("sub-local-1", {
      status: "active",
    });
  });

  it("marks invoice.payment_failed subscriptions past_due and sends a transactional email", async () => {
    const { processor, calls } = createProcessor({
      findSubscription: async () => ({
        id: "sub-local-1",
        userId: "user-1",
        status: "active",
      }),
    });
    const fixture = await signedFixture({
      id: "evt_invoice_failed",
      type: "invoice.payment_failed",
      data: { object: invoiceObject },
    });

    const outcome = await processor.process(fixture);

    expect(outcome.status).toBe("processed");
    expect(calls.updateSubscription).toHaveBeenCalledWith("sub-local-1", {
      status: "past_due",
    });
    expect(calls.emailNotifier).toHaveBeenCalledWith({
      to: "owner@example.com",
      userId: "user-1",
      invoice: expect.objectContaining({
        invoiceId: "in_123",
        amountDueCents: 2900,
      }),
    });
  });
});
