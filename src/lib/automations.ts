import type {
  automationRuns,
  automationSteps,
  automations,
  customEventDeliveries,
  customEvents,
} from "@/lib/db/schema";

export type AutomationRow = typeof automations.$inferSelect;
export type AutomationStepRow = typeof automationSteps.$inferSelect;
export type AutomationRunRow = typeof automationRuns.$inferSelect;
export type CustomEventRow = typeof customEvents.$inferSelect;
export type CustomEventDeliveryRow = typeof customEventDeliveries.$inferSelect;

type StepState = NonNullable<AutomationRunRow["stepStates"]>[string];
type RunMetricsStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

const RUN_METRIC_STATUSES: RunMetricsStatus[] = [
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "skipped",
];

export function formatStep(step: AutomationStepRow) {
  return {
    id: step.id,
    key: step.key,
    type: step.type,
    config: step.config ?? {},
    position: step.position,
  };
}

export function formatAutomation(
  automation: AutomationRow,
  steps: AutomationStepRow[],
) {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  return {
    object: "automation" as const,
    id: automation.id,
    name: automation.name,
    status: automation.status,
    trigger_event_name: automation.triggerEventName,
    connections: automation.connections ?? [],
    steps: ordered.map(formatStep),
    created_at: automation.createdAt,
    updated_at: automation.updatedAt,
  };
}

export function formatAutomationListItem(automation: AutomationRow) {
  return {
    object: "automation" as const,
    id: automation.id,
    name: automation.name,
    status: automation.status,
    trigger_event_name: automation.triggerEventName,
    created_at: automation.createdAt,
    updated_at: automation.updatedAt,
  };
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

export function formatRunListItem(run: AutomationRunRow) {
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

export function formatRunDetail(run: AutomationRunRow) {
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

export function parseRunStatusFilter(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function emptyStatusCounts(): Record<RunMetricsStatus, number> {
  return Object.fromEntries(
    RUN_METRIC_STATUSES.map((status) => [status, 0]),
  ) as Record<RunMetricsStatus, number>;
}

export function formatRunMetrics(
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

export function formatCustomEvent(event: CustomEventRow) {
  return {
    object: "event" as const,
    id: event.id,
    name: event.name,
    schema: event.schema ?? null,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
}

export function formatCustomEventDelivery(delivery: CustomEventDeliveryRow) {
  return {
    object: "event_delivery" as const,
    id: delivery.id,
    event: delivery.eventName,
    contact_id: delivery.contactId,
    email: delivery.email,
    payload: delivery.payload,
    received_at: delivery.receivedAt,
  };
}
