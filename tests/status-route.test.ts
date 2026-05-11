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
  const publicStatusModule = await vi.importActual<
    typeof import("../packages/core/src/services/publicStatus")
  >("../packages/core/src/services/publicStatus");

  return {
    createHealthService: healthServiceModule.createHealthService,
    createPublicStatusService: publicStatusModule.createPublicStatusService,
  };
});

describe("GET /api/status", () => {
  beforeEach(() => {
    vi.resetModules();
    mockDbExecute.mockReset();
    process.env.INGESTER_HEALTH_URL = "";
    process.env.BACKGROUND_JOBS_QUEUE_URL = "";
  });

  it("returns a stable public JSON shape when probes pass", async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    process.env.BACKGROUND_JOBS_QUEUE_URL = "https://sqs.example.test/queue";

    const { GET } = await import("@/app/api/status/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual(
      expect.objectContaining({
        status: "operational",
        headline: "Core systems operational",
        components: expect.any(Array),
        history: expect.any(Array),
        actions: expect.objectContaining({
          subscribe: expect.objectContaining({ label: "Subscribe to updates" }),
          report: expect.objectContaining({ label: "Report a problem" }),
          history: expect.objectContaining({ label: "View history" }),
        }),
      }),
    );
    expect(body.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "app_api", status: "operational" }),
        expect.objectContaining({ id: "dashboard", status: "operational" }),
        expect.objectContaining({
          id: "database_queue",
          status: "operational",
        }),
      ]),
    );
  });

  it("degrades failed dependencies in JSON instead of throwing", async () => {
    mockDbExecute.mockRejectedValueOnce(new Error("db host secret"));

    const { GET } = await import("@/app/api/status/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("outage");
    expect(body.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "app_api", status: "outage" }),
        expect.objectContaining({ id: "database_queue", status: "outage" }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain("db host secret");
  });
});
