import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AutomationRunBoundaryRepository,
  type AutomationRunRow,
  createAutomationRunService,
} from "../packages/core/src/services/automationRuns";

const now = new Date("2026-05-02T00:00:00.000Z");
type AutomationRow = NonNullable<
  Awaited<ReturnType<AutomationRunBoundaryRepository["findAutomationById"]>>
>;

const automation: AutomationRow = {
  id: "auto_1",
  name: "Welcome",
  status: "enabled",
  triggerEventName: "user.signed_up",
  connections: [],
  createdAt: now,
  updatedAt: now,
  userId: "user_1",
  document: null,
};

const queuedRun: AutomationRunRow = {
  id: "run_1",
  automationId: "auto_1",
  triggerEventId: "delivery_1",
  contactId: "contact_1",
  status: "queued",
  currentStepKey: "wait",
  stepStates: {
    wait: {
      status: "waiting",
      output: { waiting_for_event: "invoice.paid" },
    },
  },
  startedAt: now,
  completedAt: null,
  nextStepAt: now,
  failureReason: null,
  createdAt: now,
  updatedAt: now,
  userId: "user_1",
};

function createRepository(
  overrides: Partial<AutomationRunBoundaryRepository> = {},
) {
  const metricRuns: AutomationRunRow[] = [
    {
      ...queuedRun,
      id: "run_completed",
      status: "completed",
      currentStepKey: null,
      completedAt: new Date("2026-05-02T00:00:10.000Z"),
    },
    {
      ...queuedRun,
      id: "run_failed",
      status: "failed",
      currentStepKey: "send",
      completedAt: new Date("2026-05-02T00:00:30.000Z"),
      failureReason: "send failed",
      stepStates: { send: { status: "failed", error: "send failed" } },
    },
    {
      ...queuedRun,
      id: "run_waiting",
      status: "waiting",
      startedAt: null,
      completedAt: null,
    },
  ];
  const repository: AutomationRunBoundaryRepository = {
    findAutomationById: vi.fn(async (automationId, userId) => {
      if (automationId !== automation.id) return undefined;
      if (userId && userId !== automation.userId) return undefined;
      return automation;
    }),
    listRuns: vi.fn(async () => ({ data: [queuedRun], hasMore: false })),
    findRunByIdForAutomation: vi.fn(async (runId, automationId) => {
      if (runId === queuedRun.id && automationId === queuedRun.automationId) {
        return queuedRun;
      }
      return undefined;
    }),
    cancelRun: vi.fn(async (input) => ({
      ...queuedRun,
      status: "cancelled",
      completedAt: input.completedAt,
      nextStepAt: null,
      failureReason: input.failureReason,
      stepStates: input.stepStates,
      updatedAt: input.completedAt,
    })),
    listMetricRuns: vi.fn(async () => metricRuns),
  };

  return { ...repository, ...overrides };
}

describe("automation run service boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists tenant-scoped runs with status cursor options and preserves response shape", async () => {
    const repository = createRepository({
      listRuns: vi.fn(async () => ({
        data: [queuedRun, { ...queuedRun, id: "run_2", status: "waiting" }],
        hasMore: true,
      })),
    });
    const service = createAutomationRunService({ repository });

    const result = await service.listRuns({
      automationId: "auto_1",
      userId: "user_1",
      status: "queued, waiting",
      limit: 1,
      after: "run_3",
    });

    expect(repository.findAutomationById).toHaveBeenCalledWith(
      "auto_1",
      "user_1",
    );
    expect(repository.listRuns).toHaveBeenCalledWith({
      automationId: "auto_1",
      statuses: ["queued", "waiting"],
      limit: 1,
      after: "run_3",
    });
    expect(result).toMatchObject({
      object: "list",
      has_more: true,
    });
    expect(result.data[0]).toMatchObject({
      object: "automation_run",
      id: "run_1",
      automation_id: "auto_1",
      status: "queued",
      duration_ms: null,
    });
  });

  it("retrieves detail and reports missing runs without leaking across automations", async () => {
    const repository = createRepository();
    const service = createAutomationRunService({ repository });

    await expect(
      service.getRun({
        automationId: "auto_1",
        runId: "run_1",
        userId: "user_1",
      }),
    ).resolves.toMatchObject({
      object: "automation_run",
      id: "run_1",
      step_states: { wait: { status: "waiting" } },
    });

    await expect(
      service.getRun({
        automationId: "auto_1",
        runId: "missing",
        userId: "user_1",
      }),
    ).rejects.toMatchObject({ code: "run_not_found" });
  });

  it("treats missing or different-tenant automations as not found before run queries", async () => {
    const repository = createRepository();
    const service = createAutomationRunService({ repository });

    await expect(
      service.listRuns({ automationId: "auto_1", userId: "user_2" }),
    ).rejects.toMatchObject({
      code: "automation_not_found",
      message: "Automation not found",
    });
    expect(repository.listRuns).not.toHaveBeenCalled();
    expect(repository.findRunByIdForAutomation).not.toHaveBeenCalled();
  });

  it("cancels only queued or waiting runs and preserves cancellation metadata", async () => {
    const cancellationTime = new Date("2026-05-02T01:02:03.000Z");
    const repository = createRepository();
    const service = createAutomationRunService({
      repository,
      now: () => cancellationTime,
    });

    const result = await service.cancelRun({
      automationId: "auto_1",
      runId: "run_1",
      userId: "user_1",
      reason: "customer requested stop",
    });

    expect(repository.cancelRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run_1",
        automationId: "auto_1",
        failureReason: "customer requested stop",
        completedAt: cancellationTime,
        cancellableStatuses: ["queued", "waiting"],
      }),
    );
    expect(result).toMatchObject({
      status: "cancelled",
      failure_reason: "customer requested stop",
      completed_at: cancellationTime,
      next_step_at: null,
      step_states: {
        wait: {
          status: "cancelled",
          completedAt: cancellationTime.toISOString(),
          output: {
            waiting_for_event: "invoice.paid",
            cancellation_reason: "customer requested stop",
          },
        },
      },
    });
  });

  it("rejects cancellation when the run is already terminal or the guarded update loses the race", async () => {
    const completedRun = {
      ...queuedRun,
      status: "completed",
      completedAt: now,
      nextStepAt: null,
    };
    const terminalRepository = createRepository({
      findRunByIdForAutomation: vi.fn(async () => completedRun),
    });
    const terminalService = createAutomationRunService({
      repository: terminalRepository,
    });

    await expect(
      terminalService.cancelRun({ automationId: "auto_1", runId: "run_1" }),
    ).rejects.toMatchObject({ code: "run_not_cancellable" });
    expect(terminalRepository.cancelRun).not.toHaveBeenCalled();

    const raceRepository = createRepository({
      cancelRun: vi.fn(async () => undefined),
    });
    const raceService = createAutomationRunService({
      repository: raceRepository,
    });
    await expect(
      raceService.cancelRun({ automationId: "auto_1", runId: "run_1" }),
    ).rejects.toMatchObject({ code: "run_not_cancellable" });
  });

  it("aggregates metrics with the parsed date range delegated to the repository", async () => {
    const repository = createRepository();
    const service = createAutomationRunService({ repository });
    const from = new Date("2026-05-02T00:00:00.000Z");
    const to = new Date("2026-05-03T00:00:00.000Z");

    const metrics = await service.getMetrics({
      automationId: "auto_1",
      userId: "user_1",
      from,
      to,
    });

    expect(repository.listMetricRuns).toHaveBeenCalledWith({
      automationId: "auto_1",
      from,
      to,
    });
    expect(metrics).toMatchObject({
      object: "automation_run_metrics",
      automation_id: "auto_1",
      total_runs: 3,
      by_status: {
        queued: 0,
        running: 0,
        waiting: 1,
        completed: 1,
        failed: 1,
        cancelled: 0,
        skipped: 0,
      },
      completion_rate: 1 / 3,
      failure_rate: 1 / 3,
      average_duration_ms: 20000,
      waiting_count: 1,
      failed_steps: [{ step_key: "send", count: 1 }],
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
    });
  });
});
