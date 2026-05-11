import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbExecute = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    execute: mockDbExecute,
  },
}));

vi.mock("@opensend/core", async () => {
  const healthServiceModule = await vi.importActual<
    typeof import("../packages/core/src/services/health")
  >("../packages/core/src/services/health");

  return {
    createHealthService: healthServiceModule.createHealthService,
  };
});

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDbExecute.mockReset();
  });

  it("returns 200 and connected status when the database probe succeeds", async () => {
    mockDbExecute.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      db: "connected",
    });
    expect(mockDbExecute).toHaveBeenCalledOnce();
  });

  it("returns 503 and unreachable status when the database probe fails", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("connection refused"));

    const { GET } = await import("@/app/api/health/route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      db: "unreachable",
    });
    expect(mockDbExecute).toHaveBeenCalledOnce();
  });
});
