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
