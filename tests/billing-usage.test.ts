import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(),
  query: {
    plans: { findFirst: vi.fn() },
    subscriptions: { findFirst: vi.fn() },
    usagePeriods: { findFirst: vi.fn() },
  },
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../packages/core/src/db/client", () => ({
  db: mockDb,
}));

const stripeEnv = {
  BILLING_BACKEND: "stripe",
  STRIPE_SECRET_KEY: "sk_test_usage",
};

const now = new Date("2026-05-15T12:00:00.000Z");
const paidPlan = {
  id: "plan-lite",
  slug: "cloud_lite_15k_monthly",
  monthlyEmailQuota: 3,
  monthlyPriceCents: 1500,
  maxDomains: 3,
  maxApiKeys: 5,
};
const subscription = {
  userId: "user-1",
  planId: paidPlan.id,
  status: "active",
  currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
};

function mockActivePaidPlan() {
  mockDb.query.subscriptions.findFirst.mockResolvedValue(subscription);
  mockDb.query.plans.findFirst.mockResolvedValue(paidPlan);
}

function mockUsagePeriod(emailsSent: number) {
  mockDb.query.usagePeriods.findFirst.mockResolvedValue({
    id: "usage-1",
    emailsSent,
  });
}

function mockEmailReserveUpdate(result: Array<{ emailsSent: number }>) {
  const returning = vi.fn().mockResolvedValue(result);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  mockDb.update.mockReturnValue({ set });
  return { returning, set, where };
}

describe("reserveTransactionalEmailQuota", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb.insert.mockReset();
    mockDb.query.plans.findFirst.mockReset();
    mockDb.query.subscriptions.findFirst.mockReset();
    mockDb.query.usagePeriods.findFirst.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
  });

  it("bypasses quota when billing is disabled without reading billing tables", async () => {
    const { reserveTransactionalEmailQuota } = await import(
      "../packages/core/src/services/usageQuota"
    );

    await expect(
      reserveTransactionalEmailQuota("user-1", 99, now, {
        BILLING_BACKEND: "disabled",
      }),
    ).resolves.toEqual({ ok: true, bypassed: true });

    expect(mockDb.query.subscriptions.findFirst).not.toHaveBeenCalled();
    expect(mockDb.query.plans.findFirst).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("blocks hosted users with no active subscription", async () => {
    mockDb.query.subscriptions.findFirst.mockResolvedValue(undefined);

    const { reserveTransactionalEmailQuota } = await import(
      "../packages/core/src/services/usageQuota"
    );

    await expect(
      reserveTransactionalEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({
      ok: false,
      info: {
        resource: "emails",
        plan: "no_subscription",
        limit: 0,
        used: 0,
      },
    });

    expect(mockDb.query.plans.findFirst).not.toHaveBeenCalled();
    expect(mockDb.query.usagePeriods.findFirst).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("blocks hosted legacy free plans with reason as the plan field", async () => {
    mockDb.query.subscriptions.findFirst.mockResolvedValue({
      ...subscription,
      planId: "plan-free",
    });
    mockDb.query.plans.findFirst.mockResolvedValue({
      ...paidPlan,
      id: "plan-free",
      slug: "free",
      monthlyPriceCents: 0,
    });

    const { reserveTransactionalEmailQuota } = await import(
      "../packages/core/src/services/usageQuota"
    );

    await expect(
      reserveTransactionalEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({
      ok: false,
      info: {
        resource: "emails",
        plan: "legacy_free",
        limit: 0,
        used: 0,
      },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("allows active paid usage past included quota for overage reporting", async () => {
    mockActivePaidPlan();
    mockUsagePeriod(3);
    const update = mockEmailReserveUpdate([{ emailsSent: 4 }]);

    const { reserveTransactionalEmailQuota } = await import(
      "../packages/core/src/services/usageQuota"
    );

    await expect(
      reserveTransactionalEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({ ok: true, bypassed: false });

    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastIncrementAt: now,
        usageWarning80NotifiedAt: expect.anything(),
        usageWarning100NotifiedAt: expect.anything(),
      }),
    );
  });
});
