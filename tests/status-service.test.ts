import { describe, expect, it, vi } from "vitest";
import type { HealthService } from "../packages/core/src/services/health";
import { createPublicStatusService } from "../packages/core/src/services/publicStatus";

function health(status: "ok" | "error"): HealthService {
  return {
    async check() {
      return status === "ok"
        ? { status: "ok", db: "connected" }
        : { status: "error", db: "unreachable" };
    },
  };
}

const fixedNow = () => new Date("2026-05-11T12:00:00.000Z");

describe("createPublicStatusService", () => {
  it("builds a public status snapshot with component uptime and no-incident history", async () => {
    const service = createPublicStatusService({
      health: health("ok"),
      ingesterProbe: async () => ({ ok: true }),
      queueConfigured: () => true,
      now: fixedNow,
    });

    const snapshot = await service.snapshot();

    expect(snapshot.status).toBe("operational");
    expect(snapshot.headline).toBe("Core systems operational");
    expect(snapshot.components.map((component) => component.id)).toEqual([
      "app_api",
      "dashboard",
      "ingester_webhooks",
      "database_queue",
    ]);
    expect(
      snapshot.components.every(
        (component) => component.uptime.label === "100.00% uptime",
      ),
    ).toBe(true);
    expect(snapshot.history).toEqual([
      {
        id: "no-incidents-2026-05-11",
        date: "2026-05-11",
        title: "No incidents",
        summary: "No incidents recorded for OpenSend components.",
        impact: "none",
      },
      {
        id: "no-incidents-2026-05-10",
        date: "2026-05-10",
        title: "No incidents",
        summary: "No incidents recorded for OpenSend components.",
        impact: "none",
      },
      {
        id: "no-incidents-2026-05-09",
        date: "2026-05-09",
        title: "No incidents",
        summary: "No incidents recorded for OpenSend components.",
        impact: "none",
      },
    ]);
    expect(snapshot.actions.report.href).toContain(
      "github.com/namuh-eng/opensend",
    );
  });

  it("marks unavailable probes as non-OK without exposing raw errors", async () => {
    const ingesterProbe = vi
      .fn<() => Promise<{ ok: boolean }>>()
      .mockRejectedValue(new Error("connection refused with internal host"));
    const service = createPublicStatusService({
      health: health("error"),
      ingesterProbe,
      queueConfigured: () => true,
      now: fixedNow,
    });

    const snapshot = await service.snapshot();

    expect(snapshot.status).toBe("outage");
    expect(snapshot.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "app_api",
          status: "outage",
          message:
            "The public API health probe cannot reach its database dependency.",
        }),
        expect.objectContaining({
          id: "ingester_webhooks",
          status: "degraded",
          message: "Configured ingester health probe is not reporting healthy.",
        }),
        expect.objectContaining({
          id: "database_queue",
          status: "outage",
          message:
            "Database probe failed, so queue-backed work may also be affected.",
        }),
      ]),
    );
    expect(JSON.stringify(snapshot)).not.toContain("connection refused");
  });

  it("labels unwired optional probes as unknown instead of pretending full coverage", async () => {
    const service = createPublicStatusService({
      health: health("ok"),
      queueConfigured: () => false,
      now: fixedNow,
    });

    const snapshot = await service.snapshot();

    expect(snapshot.status).toBe("operational");
    expect(snapshot.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ingester_webhooks",
          status: "unknown",
          lastCheckedAt: null,
        }),
        expect.objectContaining({
          id: "database_queue",
          status: "unknown",
          message:
            "Database probe passed; queue readiness is not configured for this deployment.",
        }),
      ]),
    );
  });
});
