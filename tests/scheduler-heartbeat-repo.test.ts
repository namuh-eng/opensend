import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpsertReturning = vi.fn();
const mockUpsertOnConflict = vi.fn();
const mockUpsertValues = vi.fn();
const mockInsert = vi.fn();
const mockFindFirst = vi.fn();
const mockSelect = vi.fn();

vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      schedulerHeartbeats: {
        findFirst: mockFindFirst,
      },
    },
    insert: mockInsert,
    select: mockSelect,
  },
}));

describe("schedulerHeartbeatRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUpsertReturning.mockResolvedValue([
      {
        jobName: "domain-verify",
        lastSeenAt: new Date("2026-05-28T12:00:00.000Z"),
        lastResult: { interval_ms: 60000, status: "ok" },
      },
    ]);
    mockUpsertOnConflict.mockReturnValue({ returning: mockUpsertReturning });
    mockUpsertValues.mockReturnValue({
      onConflictDoUpdate: mockUpsertOnConflict,
    });
    mockInsert.mockReturnValue({ values: mockUpsertValues });
  });

  it("upsert returns the inserted/updated row", async () => {
    const { schedulerHeartbeatRepo } = await import(
      "../packages/core/src/db/repositories/schedulerHeartbeatRepo"
    );

    const result = await schedulerHeartbeatRepo.upsert("domain-verify", {
      interval_ms: 60000,
      status: "ok",
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockUpsertValues).toHaveBeenCalledOnce();
    expect(mockUpsertOnConflict).toHaveBeenCalledOnce();
    expect(result.jobName).toBe("domain-verify");
    expect(result.lastResult).toEqual({ interval_ms: 60000, status: "ok" });
  });

  it("findByJobName delegates to db.query.schedulerHeartbeats.findFirst", async () => {
    const row = {
      jobName: "webhooks",
      lastSeenAt: new Date("2026-05-28T11:00:00.000Z"),
      lastResult: { interval_ms: 60000, status: "ok" },
    };
    mockFindFirst.mockResolvedValue(row);

    const { schedulerHeartbeatRepo } = await import(
      "../packages/core/src/db/repositories/schedulerHeartbeatRepo"
    );

    const result = await schedulerHeartbeatRepo.findByJobName("webhooks");

    expect(mockFindFirst).toHaveBeenCalledOnce();
    expect(result).toEqual(row);
  });

  it("findByJobName returns undefined when no row exists", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const { schedulerHeartbeatRepo } = await import(
      "../packages/core/src/db/repositories/schedulerHeartbeatRepo"
    );

    const result = await schedulerHeartbeatRepo.findByJobName("missing-job");
    expect(result).toBeUndefined();
  });

  it("listAll returns all rows via select", async () => {
    const rows = [
      {
        jobName: "domain-verify",
        lastSeenAt: new Date("2026-05-28T12:00:00.000Z"),
        lastResult: { interval_ms: 60000, status: "ok" },
      },
      {
        jobName: "webhooks",
        lastSeenAt: new Date("2026-05-28T11:30:00.000Z"),
        lastResult: { interval_ms: 60000, status: "ok" },
      },
    ];
    const mockFrom = vi.fn().mockResolvedValue(rows);
    mockSelect.mockReturnValue({ from: mockFrom });

    const { schedulerHeartbeatRepo } = await import(
      "../packages/core/src/db/repositories/schedulerHeartbeatRepo"
    );

    const result = await schedulerHeartbeatRepo.listAll();

    expect(mockSelect).toHaveBeenCalledOnce();
    expect(result).toEqual(rows);
  });
});
