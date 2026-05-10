import { type SQL, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  type HealthProbeDatabase,
  createHealthService,
} from "../packages/core/src/services/health";

describe("createHealthService", () => {
  it("returns ok when the SELECT 1 database probe succeeds", async () => {
    const execute = vi
      .fn<(query: SQL) => Promise<unknown>>()
      .mockResolvedValue([]);
    const database: HealthProbeDatabase = { execute };
    const service = createHealthService({ database });

    await expect(service.check()).resolves.toEqual({
      status: "ok",
      db: "connected",
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(sql`SELECT 1`);
  });

  it("returns error when the SELECT 1 database probe fails", async () => {
    const execute = vi
      .fn<(query: SQL) => Promise<unknown>>()
      .mockRejectedValue(new Error("database unavailable"));
    const database: HealthProbeDatabase = { execute };
    const service = createHealthService({ database });

    await expect(service.check()).resolves.toEqual({
      status: "error",
      db: "unreachable",
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(sql`SELECT 1`);
  });
});
