import {
  automationRuns,
  automationSteps,
  automations,
  customEventDeliveries,
  customEvents,
} from "@/lib/db/schema";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("Automations schema", () => {
  it("registers all automation tables under expected names", () => {
    expect(getTableName(automations)).toBe("automations");
    expect(getTableName(automationSteps)).toBe("automation_steps");
    expect(getTableName(automationRuns)).toBe("automation_runs");
    expect(getTableName(customEvents)).toBe("custom_events");
    expect(getTableName(customEventDeliveries)).toBe("custom_event_deliveries");
  });

  it("automations table exposes the columns the runner foundation needs", () => {
    const cols = getTableColumns(automations);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.triggerEventName).toBeDefined();
    expect(cols.connections).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
    expect(cols.userId).toBeDefined();
    expect(cols.document).toBeDefined();
    expect(cols.status.notNull).toBe(true);
  });

  it("automation_steps enforces non-null type/key/config and unique key per automation", () => {
    const cols = getTableColumns(automationSteps);
    expect(cols.automationId.notNull).toBe(true);
    expect(cols.key.notNull).toBe(true);
    expect(cols.type.notNull).toBe(true);
    expect(cols.config.notNull).toBe(true);
    expect(cols.position.notNull).toBe(true);
  });

  it("automation_runs tracks status, current step, and scheduling fields", () => {
    const cols = getTableColumns(automationRuns);
    expect(cols.automationId.notNull).toBe(true);
    expect(cols.triggerEventId).toBeDefined();
    expect(cols.contactId).toBeDefined();
    expect(cols.status.notNull).toBe(true);
    expect(cols.currentStepKey).toBeDefined();
    expect(cols.stepStates).toBeDefined();
    expect(cols.startedAt).toBeDefined();
    expect(cols.completedAt).toBeDefined();
    expect(cols.nextStepAt).toBeDefined();
    expect(cols.failureReason).toBeDefined();
  });

  it("custom_events and custom_event_deliveries persist event metadata and inbox rows", () => {
    const eventCols = getTableColumns(customEvents);
    expect(eventCols.name.notNull).toBe(true);
    expect(eventCols.schema).toBeDefined();
    expect(eventCols.userId).toBeDefined();

    const deliveryCols = getTableColumns(customEventDeliveries);
    expect(deliveryCols.eventName.notNull).toBe(true);
    expect(deliveryCols.payload.notNull).toBe(true);
    expect(deliveryCols.contactId).toBeDefined();
    expect(deliveryCols.email).toBeDefined();
    expect(deliveryCols.receivedAt.notNull).toBe(true);
  });
});
