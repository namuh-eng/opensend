import { automationRepo } from "../db/repositories/automationRepo";
import { automationRunRepo } from "../db/repositories/automationRunRepo";
import type {
  AutomationStepStateEntry,
  automationRuns,
  automations,
} from "../db/schema";

type AutomationRow = typeof automations.$inferSelect;
export type AutomationRunRow = typeof automationRuns.$inferSelect;
type AutomationRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

type RunMetricsStatus = AutomationRunStatus;
type StepState = AutomationStepStateEntry;

const RUN_METRIC_STATUSES: RunMetricsStatus[] = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "skipped",
];

const CANCELLABLE_RUN_STATUSES = ["queued", "waiting"] as const;

type CancellableRunStatus = (typeof CANCELLABLE_RUN_STATUSES)[number];

export type AutomationRunServiceErrorCode =
  | "automation_not_found"
  | "run_not_found"
  | "run_not_cancellable";

export class AutomationRunServiceError extends Error {
  constructor(
    readonly code: AutomationRunServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AutomationRunServiceError";
  }
}

export type AutomationRunListItem = ReturnType<typeof toRunListItem>;
export type AutomationRunDetailResponse = ReturnType<typeof toRunDetail>;
export type AutomationRunMetricsResponse = ReturnType<typeof toRunMetrics>;

export type AutomationRunListResponse = {
  object: "list";
  data: AutomationRunListItem[];
  has_more: boolean;
};

export type AutomationRunBoundaryRepository = {
  findAutomationById(
    automationId: string,
    userId?: string | null,
  ): Promise<AutomationRow | undefined>;
  listRuns(input: {
    automationId: string;
    statuses: string[];
    limit: number;
    after?: string;
  }): Promise<{ data: AutomationRunRow[]; hasMore: boolean }>;
  findRunByIdForAutomation(
    runId: string,
    automationId: string,
  ): Promise<AutomationRunRow | undefined>;
  cancelRun(input: {
    runId: string;
    automationId: string;
    stepStates: NonNullable<AutomationRunRow["stepStates"]>;
    failureReason: string;
    completedAt: Date;
    cancellableStatuses: readonly CancellableRunStatus[];
  }): Promise<AutomationRunRow | undefined>;
  listMetricRuns(input: {
    automationId: string;
    from?: Date;
    to?: Date;
  }): Promise<AutomationRunRow[]>;
};

export type AutomationRunServiceDependencies = {
  repository?: AutomationRunBoundaryRepository;
  now?: () => Date;
};

export type ListAutomationRunsInput = {
  automationId: string;
  userId?: string | null;
  status?: string;
  limit?: number;
  after?: string;
};

export type GetAutomationRunInput = {
  automationId: string;
  runId: string;
  userId?: string | null;
};

export type CancelAutomationRunInput = GetAutomationRunInput & {
  reason?: string;
};

export type GetAutomationRunMetricsInput = {
  automationId: string;
  userId?: string | null;
  from?: Date;
  to?: Date;
};

function defaultRepository(): AutomationRunBoundaryRepository {
  return {
    findAutomationById: (automationId, userId) =>
      automationRepo.findByIdForUser(automationId, userId),
    listRuns: (input) => automationRunRepo.listForApi(input),
    findRunByIdForAutomation: (runId, automationId) =>
      automationRunRepo.findByIdForAutomation(runId, automationId),
    cancelRun: (input) => automationRunRepo.cancelForApi(input),
    listMetricRuns: (input) => automationRunRepo.listForMetrics(input),
  };
}

function normalizeLimit(limit: number | undefined): number {
  return limit ?? 25;
}

export function parseRunStatusFilter(
  value: string | null | undefined,
): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function findFailedStepKey(
  stepStates: AutomationRunRow["stepStates"],
): string | null {
  if (!stepStates) return null;
  for (const [key, state] of Object.entries(stepStates) as Array<
    [string, StepState]
  >) {
    if (state.status === "failed") return key;
  }
  return null;
}

function durationMs(run: AutomationRunRow): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  return Math.max(0, run.completedAt.getTime() - run.startedAt.getTime());
}

function toRunListItem(run: AutomationRunRow) {
  return {
    object: "automation_run" as const,
    id: run.id,
    automation_id: run.automationId,
    status: run.status,
    started_at: run.startedAt,
    completed_at: run.completedAt,
    duration_ms: durationMs(run),
    current_step_key: run.currentStepKey,
    failed_step_key: findFailedStepKey(run.stepStates),
    failure_reason: run.failureReason,
    next_step_at: run.nextStepAt,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  };
}

function toRunDetail(run: AutomationRunRow) {
  return {
    object: "automation_run" as const,
    id: run.id,
    automation_id: run.automationId,
    trigger_event_id: run.triggerEventId,
    contact_id: run.contactId,
    status: run.status,
    current_step_key: run.currentStepKey,
    failed_step_key: findFailedStepKey(run.stepStates),
    failure_reason: run.failureReason,
    step_states: run.stepStates ?? {},
    started_at: run.startedAt,
    completed_at: run.completedAt,
    next_step_at: run.nextStepAt,
    duration_ms: durationMs(run),
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  };
}

function emptyStatusCounts(): Record<RunMetricsStatus, number> {
  return Object.fromEntries(
    RUN_METRIC_STATUSES.map((status) => [status, 0]),
  ) as Record<RunMetricsStatus, number>;
}

function toRunMetrics(
  automationId: string,
  runs: AutomationRunRow[],
  range: { from?: Date; to?: Date } = {},
) {
  const byStatus = emptyStatusCounts();
  const failedSteps = new Map<string, number>();
  let durationTotal = 0;
  let durationCount = 0;

  for (const run of runs) {
    if (RUN_METRIC_STATUSES.includes(run.status as RunMetricsStatus)) {
      byStatus[run.status as RunMetricsStatus] += 1;
    }

    const duration = durationMs(run);
    if (duration !== null) {
      durationTotal += duration;
      durationCount += 1;
    }

    const failedStepKey = findFailedStepKey(run.stepStates);
    if (failedStepKey) {
      failedSteps.set(failedStepKey, (failedSteps.get(failedStepKey) ?? 0) + 1);
    }
  }

  const totalRuns = runs.length;
  const failedStepSummary = [...failedSteps.entries()]
    .map(([stepKey, count]) => ({ step_key: stepKey, count }))
    .sort((a, b) => b.count - a.count || a.step_key.localeCompare(b.step_key))
    .slice(0, 10);

  return {
    object: "automation_run_metrics" as const,
    automation_id: automationId,
    total_runs: totalRuns,
    by_status: byStatus,
    completion_rate: totalRuns > 0 ? byStatus.completed / totalRuns : 0,
    failure_rate: totalRuns > 0 ? byStatus.failed / totalRuns : 0,
    average_duration_ms:
      durationCount > 0 ? Math.round(durationTotal / durationCount) : null,
    waiting_count: byStatus.waiting,
    failed_steps: failedStepSummary,
    range: {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    },
  };
}

function isCancellableStatus(status: string): status is CancellableRunStatus {
  return CANCELLABLE_RUN_STATUSES.includes(status as CancellableRunStatus);
}

function cancellableError(): AutomationRunServiceError {
  return new AutomationRunServiceError(
    "run_not_cancellable",
    "Run is not cancellable",
  );
}

export function createAutomationRunService({
  repository = defaultRepository(),
  now = () => new Date(),
}: AutomationRunServiceDependencies = {}) {
  async function requireAutomation(input: {
    automationId: string;
    userId?: string | null;
  }): Promise<AutomationRow> {
    const automation = await repository.findAutomationById(
      input.automationId,
      input.userId,
    );
    if (!automation) {
      throw new AutomationRunServiceError(
        "automation_not_found",
        "Automation not found",
      );
    }
    return automation;
  }

  return {
    async listRuns(
      input: ListAutomationRunsInput,
    ): Promise<AutomationRunListResponse> {
      const automation = await requireAutomation(input);
      const result = await repository.listRuns({
        automationId: automation.id,
        statuses: parseRunStatusFilter(input.status),
        limit: normalizeLimit(input.limit),
        after: input.after || undefined,
      });

      return {
        object: "list",
        data: result.data.map(toRunListItem),
        has_more: result.hasMore,
      };
    },

    async getRun(
      input: GetAutomationRunInput,
    ): Promise<AutomationRunDetailResponse> {
      const automation = await requireAutomation(input);
      const run = await repository.findRunByIdForAutomation(
        input.runId,
        automation.id,
      );
      if (!run) {
        throw new AutomationRunServiceError("run_not_found", "Run not found");
      }
      return toRunDetail(run);
    },

    async cancelRun(
      input: CancelAutomationRunInput,
    ): Promise<AutomationRunDetailResponse> {
      const automation = await requireAutomation(input);
      const run = await repository.findRunByIdForAutomation(
        input.runId,
        automation.id,
      );
      if (!run) {
        throw new AutomationRunServiceError("run_not_found", "Run not found");
      }
      if (!isCancellableStatus(run.status)) throw cancellableError();

      const completedAt = now();
      const reason = input.reason ?? "cancelled_by_api";
      const stepStates = { ...(run.stepStates ?? {}) };
      if (run.currentStepKey) {
        const currentState: StepState = stepStates[run.currentStepKey] ?? {
          status: "pending",
        };
        stepStates[run.currentStepKey] = {
          ...currentState,
          status: "cancelled",
          completedAt: completedAt.toISOString(),
          output: {
            ...(currentState.output ?? {}),
            cancellation_reason: reason,
          },
        };
      }

      const updated = await repository.cancelRun({
        runId: run.id,
        automationId: automation.id,
        stepStates,
        failureReason: reason,
        completedAt,
        cancellableStatuses: CANCELLABLE_RUN_STATUSES,
      });
      if (!updated) throw cancellableError();

      return toRunDetail(updated);
    },

    async getMetrics(
      input: GetAutomationRunMetricsInput,
    ): Promise<AutomationRunMetricsResponse> {
      const automation = await requireAutomation(input);
      const runs = await repository.listMetricRuns({
        automationId: automation.id,
        from: input.from,
        to: input.to,
      });

      return toRunMetrics(automation.id, runs, {
        from: input.from,
        to: input.to,
      });
    },
  };
}

export const automationRunService = createAutomationRunService();
