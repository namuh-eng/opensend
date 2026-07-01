import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      plans: { findFirst: mockFindFirst },
    },
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

describe("planRepo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("findBySlug returns the matching plan row", async () => {
    const plan = {
      id: "plan_lite",
      slug: "cloud_lite_15k_monthly",
      name: "Lite",
      monthlyPriceCents: 1000,
    };
    mockFindFirst.mockResolvedValue(plan);

    const { planRepo } = await import(
      "../packages/core/src/db/repositories/planRepo"
    );

    const row = await planRepo.findBySlug("cloud_lite_15k_monthly");
    expect(row).toEqual(plan);
    expect(mockFindFirst).toHaveBeenCalledOnce();
  });

  it("findById returns undefined when no plan matches", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const { planRepo } = await import(
      "../packages/core/src/db/repositories/planRepo"
    );

    const row = await planRepo.findById("missing");
    expect(row).toBeUndefined();
  });

  it("no longer exposes ensureFreePlan (free tier removed)", async () => {
    const { planRepo } = await import(
      "../packages/core/src/db/repositories/planRepo"
    );
    expect(
      (planRepo as Record<string, unknown>).ensureFreePlan,
    ).toBeUndefined();
  });
});
