/**
 * Unit tests for dedicatedIpPoolRepo.
 *
 * The repo talks to the database through Drizzle. We mock the DB client
 * at its internal package path so no real Postgres connection is needed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock objects (must be created before vi.mock factory runs) ─────────
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());

// Mock the DB client at the internal path that the repo imports from.
// The repo imports `db` from "../client" which resolves to
// packages/core/src/db/client.ts — we intercept it here so no real
// Postgres connection is attempted.
vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      dedicatedIpPools: { findFirst: mockFindFirst },
    },
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
  },
}));

import { dedicatedIpPoolRepo } from "@opensend/core";

const POOL = {
  id: "pool-uuid-1",
  userId: "user-1",
  name: "My Pool",
  sesPoolName: "my-ses-pool",
  scalingMode: "MANAGED",
  status: "active",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
} as const;

describe("dedicatedIpPoolRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("findById", () => {
    it("resolves with pool when found", async () => {
      mockFindFirst.mockResolvedValueOnce(POOL);
      const result = await dedicatedIpPoolRepo.findById("pool-uuid-1");
      expect(result).toEqual(POOL);
      expect(mockFindFirst).toHaveBeenCalledOnce();
    });

    it("resolves with undefined when not found", async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);
      const result = await dedicatedIpPoolRepo.findById("unknown");
      expect(result).toBeUndefined();
    });
  });

  describe("findByIdForUser", () => {
    it("returns undefined when pool not found for that user", async () => {
      mockFindFirst.mockResolvedValueOnce(undefined);
      const result = await dedicatedIpPoolRepo.findByIdForUser(
        "pool-uuid-1",
        "other-user",
      );
      expect(result).toBeUndefined();
    });

    it("returns pool when userId matches", async () => {
      mockFindFirst.mockResolvedValueOnce(POOL);
      const result = await dedicatedIpPoolRepo.findByIdForUser(
        "pool-uuid-1",
        "user-1",
      );
      expect(result).toEqual(POOL);
    });
  });

  describe("create", () => {
    it("inserts pool and returns row", async () => {
      const returningMock = vi.fn().mockResolvedValueOnce([POOL]);
      const valuesMock = vi
        .fn()
        .mockReturnValueOnce({ returning: returningMock });
      mockInsert.mockReturnValueOnce({ values: valuesMock });

      const result = await dedicatedIpPoolRepo.create({
        userId: POOL.userId,
        name: POOL.name,
        sesPoolName: POOL.sesPoolName,
        scalingMode: POOL.scalingMode,
        status: POOL.status,
      });

      expect(result).toEqual(POOL);
      expect(mockInsert).toHaveBeenCalledOnce();
    });
  });

  describe("updateStatus", () => {
    it("sets status", async () => {
      const returningMock = vi
        .fn()
        .mockResolvedValueOnce([{ ...POOL, status: "failed" }]);
      const whereMock = vi
        .fn()
        .mockReturnValueOnce({ returning: returningMock });
      const setMock = vi.fn().mockReturnValueOnce({ where: whereMock });
      mockUpdate.mockReturnValueOnce({ set: setMock });

      const result = await dedicatedIpPoolRepo.updateStatus(
        "pool-uuid-1",
        "failed",
      );
      expect(result).toMatchObject({ status: "failed" });
    });
  });

  describe("deleteForUser", () => {
    it("removes pool and returns deleted id", async () => {
      const returningMock = vi
        .fn()
        .mockResolvedValueOnce([{ id: "pool-uuid-1" }]);
      const whereMock = vi
        .fn()
        .mockReturnValueOnce({ returning: returningMock });
      mockDelete.mockReturnValueOnce({ where: whereMock });

      const result = await dedicatedIpPoolRepo.deleteForUser(
        "pool-uuid-1",
        "user-1",
      );
      expect(result).toEqual({ id: "pool-uuid-1" });
    });
  });
});
