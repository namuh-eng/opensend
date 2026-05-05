import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      plans: { findFirst: mockFindFirst },
    },
    insert: mockInsert,
    select: vi.fn(),
  },
}));

describe("planRepo.ensureFreePlan", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockOnConflictDoNothing.mockReturnValue({ returning: mockInsertReturning });
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
      onConflictDoNothing: mockOnConflictDoNothing,
    });
    mockInsert.mockReturnValue({ values: mockInsertValues });
  });

  it("inserts the Free plan with the documented quota when no row exists", async () => {
    const inserted = {
      id: "plan_free",
      slug: "free",
      name: "Free",
      monthlyPriceCents: 0,
      monthlyEmailQuota: 3000,
      maxDomains: 1,
      maxApiKeys: 3,
      isPublic: true,
    };
    mockInsertReturning.mockResolvedValue([inserted]);

    const { planRepo } = await import(
      "../packages/core/src/db/repositories/planRepo"
    );

    const row = await planRepo.ensureFreePlan();

    expect(row).toEqual(inserted);
    expect(mockInsertValues).toHaveBeenCalledWith({
      slug: "free",
      name: "Free",
      monthlyPriceCents: 0,
      monthlyEmailQuota: 3000,
      maxDomains: 1,
      maxApiKeys: 3,
      isPublic: true,
    });
    expect(mockOnConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("returns the pre-existing Free plan when the conflict guard swallows the insert", async () => {
    const existing = { id: "plan_free", slug: "free", name: "Free" };
    mockInsertReturning.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(existing);

    const { planRepo } = await import(
      "../packages/core/src/db/repositories/planRepo"
    );

    const row = await planRepo.ensureFreePlan();

    expect(row).toEqual(existing);
    expect(mockFindFirst).toHaveBeenCalledOnce();
  });

  it("throws if the conflict guard fires but the row cannot be reloaded", async () => {
    mockInsertReturning.mockResolvedValue([]);
    mockFindFirst.mockResolvedValue(undefined);

    const { planRepo } = await import(
      "../packages/core/src/db/repositories/planRepo"
    );

    await expect(planRepo.ensureFreePlan()).rejects.toThrow(/Free plan/);
  });
});
