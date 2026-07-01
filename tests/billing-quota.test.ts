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

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

const stripeEnv = {
  BILLING_BACKEND: "stripe",
  STRIPE_SECRET_KEY: "sk_test_quota",
};

const now = new Date("2026-05-15T12:00:00.000Z");
const legacyFreePlan = {
  id: "plan-free",
  slug: "free",
  monthlyEmailQuota: 3,
  monthlyPriceCents: 0,
  maxDomains: 1,
  maxApiKeys: 2,
};
const paidPlan = {
  ...legacyFreePlan,
  id: "plan-starter",
  slug: "cloud_starter_55k_monthly",
  monthlyPriceCents: 1900,
};
const subscription = {
  userId: "user-1",
  planId: paidPlan.id,
  status: "active",
  currentPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
  currentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
};

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

function mockPlanContext(selectedPlan = paidPlan) {
  mockDb.query.subscriptions.findFirst.mockResolvedValue({
    ...subscription,
    planId: selectedPlan.id,
  });
  mockDb.query.plans.findFirst.mockResolvedValue(selectedPlan);
}

function mockCount(value: number) {
  const where = vi.fn().mockResolvedValue([{ value }]);
  const from = vi.fn().mockReturnValue({ where });
  mockDb.select.mockReturnValue({ from });
}

describe("billing quota enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDb.insert.mockReset();
    mockDb.query.plans.findFirst.mockReset();
    mockDb.query.subscriptions.findFirst.mockReset();
    mockDb.query.usagePeriods.findFirst.mockReset();
    mockDb.select.mockReset();
    mockDb.update.mockReset();
  });

  it("bypasses quota checks when billing is disabled or Stripe config is absent", async () => {
    const { reserveEmailQuota } = await import("@/lib/billing/quota");

    await expect(
      reserveEmailQuota("user-1", 99, now, { BILLING_BACKEND: "disabled" }),
    ).resolves.toEqual({ ok: true, bypassed: true });
    await expect(
      reserveEmailQuota("user-1", 99, now, { BILLING_BACKEND: "stripe" }),
    ).resolves.toEqual({ ok: true, bypassed: true });
    expect(mockDb.query.subscriptions.findFirst).not.toHaveBeenCalled();
  });

  it("allows active paid sends under included quota and uses one UPDATE for the increment", async () => {
    mockPlanContext();
    mockUsagePeriod(1);
    const update = mockEmailReserveUpdate([{ emailsSent: 2 }]);

    const { reserveEmailQuota } = await import("@/lib/billing/quota");
    const result = await reserveEmailQuota("user-1", 1, now, stripeEnv);

    expect(result).toEqual({ ok: true, bypassed: false });
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(update.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastIncrementAt: now }),
    );
    expect(update.returning).toHaveBeenCalledWith(
      expect.objectContaining({ emailsSent: expect.anything() }),
    );
  });

  it("allows paid sends past quota and records threshold hooks instead of returning 402", async () => {
    mockDb.query.subscriptions.findFirst.mockResolvedValue({
      ...subscription,
      planId: paidPlan.id,
    });
    mockDb.query.plans.findFirst.mockResolvedValue(paidPlan);
    mockUsagePeriod(3);
    const update = mockEmailReserveUpdate([{ emailsSent: 4 }]);

    const { reserveEmailQuota } = await import("@/lib/billing/quota");
    await expect(
      reserveEmailQuota("user-1", 1, now, stripeEnv),
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

  it("blocks hosted users with no active subscription before reserving email quota", async () => {
    mockDb.query.subscriptions.findFirst.mockResolvedValue(undefined);

    const { reserveEmailQuota } = await import("@/lib/billing/quota");
    await expect(
      reserveEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({
      ok: false,
      info: {
        resource: "emails",
        plan: "no_subscription",
        limit: 0,
        used: 0,
        upgrade_url: "/dashboard/billing",
      },
    });

    expect(mockDb.query.plans.findFirst).not.toHaveBeenCalled();
    expect(mockDb.query.usagePeriods.findFirst).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("blocks legacy free plans with 402 info instead of allowing a boundary send", async () => {
    mockPlanContext(legacyFreePlan);

    const { reserveEmailQuota } = await import("@/lib/billing/quota");
    await expect(
      reserveEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({
      ok: false,
      info: {
        resource: "emails",
        plan: "legacy_free",
        limit: 0,
        used: 0,
        upgrade_url: "/dashboard/billing",
      },
    });

    expect(mockDb.query.usagePeriods.findFirst).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("creates the current monthly usage period lazily", async () => {
    mockPlanContext();
    mockDb.query.usagePeriods.findFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue({ id: "usage-1", emailsSent: 0 });
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "usage-1", emailsSent: 0 }]),
        }),
      }),
    });
    mockEmailReserveUpdate([{ emailsSent: 1 }]);

    const { reserveEmailQuota } = await import("@/lib/billing/quota");
    await expect(
      reserveEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({ ok: true, bypassed: false });

    const values = mockDb.insert.mock.results[0]?.value.values;
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        emailsSent: 0,
      }),
    );
  });

  it("keeps blocking past-due subscriptions after the grace period expires", async () => {
    mockDb.query.subscriptions.findFirst.mockResolvedValue({
      ...subscription,
      status: "past_due",
      currentPeriodEnd: new Date("2026-05-10T00:00:00.000Z"),
    });

    const { reserveEmailQuota } = await import("@/lib/billing/quota");
    await expect(
      reserveEmailQuota("user-1", 1, now, stripeEnv),
    ).resolves.toEqual({
      ok: false,
      info: {
        resource: "emails",
        plan: "past_due",
        limit: 0,
        used: 0,
        upgrade_url: "/dashboard/billing",
      },
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("gates domain and API key counts against active paid plan limits", async () => {
    mockPlanContext();
    mockCount(1);

    const { checkApiKeyQuota, checkDomainQuota } = await import(
      "@/lib/billing/quota"
    );

    await expect(checkDomainQuota("user-1", now, stripeEnv)).resolves.toEqual({
      ok: false,
      info: {
        resource: "domains",
        plan: paidPlan.slug,
        limit: 1,
        used: 1,
        upgrade_url: "/dashboard/billing",
      },
    });

    mockCount(1);
    await expect(checkApiKeyQuota("user-1", now, stripeEnv)).resolves.toEqual({
      ok: true,
      bypassed: false,
    });
  });
});
