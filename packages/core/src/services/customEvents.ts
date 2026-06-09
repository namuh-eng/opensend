import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { automationRepo } from "../db/repositories/automationRepo";
import { automationRunRepo } from "../db/repositories/automationRunRepo";
import {
  type CreateCustomEventInput,
  type RecordCustomEventDeliveryInput,
  type UpdateCustomEventInput,
  customEventDeliveryRepo,
  customEventRepo,
} from "../db/repositories/customEventRepo";
import {
  type AutomationStepStateEntry,
  type automationRuns,
  type automations,
  contacts,
  type customEventDeliveries,
  type customEvents,
} from "../db/schema";
import {
  type EventSchemaIssue,
  isRecord,
  validateEventPayloadAgainstSchema,
} from "../dto/automations";

export type CustomEventRow = typeof customEvents.$inferSelect;
export type CustomEventDeliveryRow = typeof customEventDeliveries.$inferSelect;
export type CustomEventAutomationRunRow = typeof automationRuns.$inferSelect;
type AutomationRow = typeof automations.$inferSelect;
type StepState = AutomationStepStateEntry;

export type CreateCustomEventServiceInput = {
  userId: string | null;
  data: {
    name: string;
    schema?: Record<string, unknown> | null;
  };
};

export type ListCustomEventsServiceInput = {
  userId: string | null;
  limit?: number;
  after?: string;
};

export type GetCustomEventServiceInput = {
  userId: string | null;
  identifier: string;
};

export type UpdateCustomEventServiceInput = {
  userId: string | null;
  identifier: string;
  data: UpdateCustomEventInput;
};

export type DeleteCustomEventServiceInput = {
  userId: string | null;
  identifier?: string;
  id?: string;
};

export type SendCustomEventServiceInput = {
  userId: string | null;
  data: {
    event: string;
    contact_id?: string;
    contactId?: string;
    email?: string;
    payload?: Record<string, unknown>;
  };
};

export type CustomEventServiceErrorCode =
  | "event_payload_invalid"
  | "event_schema_invalid"
  | "not_found";

export class CustomEventServiceError extends Error {
  constructor(
    readonly code: CustomEventServiceErrorCode,
    message: string,
    readonly details?: EventSchemaIssue[],
  ) {
    super(message);
    this.name = "CustomEventServiceError";
  }
}

export type CustomEventResponse = ReturnType<typeof toCustomEventResponse>;
export type CustomEventDeliveryResponse = ReturnType<
  typeof toCustomEventDeliveryResponse
>;
export type AutomationRunListItemResponse = ReturnType<
  typeof toRunListItemResponse
>;

export type CustomEventListResponse = {
  object: "list";
  data: CustomEventResponse[];
  has_more: boolean;
};

export type CustomEventDeleteResponse = {
  object: "event";
  id: string;
  deleted: true;
};

export type SendCustomEventResponse = {
  object: "event_delivery";
  delivery: CustomEventDeliveryResponse;
  resumed_runs: AutomationRunListItemResponse[];
  automation_runs: AutomationRunListItemResponse[];
};

export type CustomEventBoundaryRepository = {
  create(input: CreateCustomEventInput): Promise<CustomEventRow>;
  list(input: {
    limit: number;
    after?: string;
    userId?: string | null;
  }): Promise<{ data: CustomEventRow[]; hasMore: boolean }>;
  findByName(
    name: string,
    userId?: string | null,
  ): Promise<CustomEventRow | undefined>;
  findByIdentifierForUser(
    identifier: string,
    userId?: string | null,
  ): Promise<CustomEventRow | undefined>;
  updateForUser(
    id: string,
    userId: string | null | undefined,
    input: UpdateCustomEventInput,
  ): Promise<CustomEventRow | undefined>;
  deleteForUser(
    id: string,
    userId?: string | null,
  ): Promise<Array<{ id: string }>>;
  resolveContactId(input: {
    contactId?: string;
    email?: string;
    userId: string | null;
  }): Promise<string | null>;
  recordDelivery(
    input: RecordCustomEventDeliveryInput,
  ): Promise<CustomEventDeliveryRow>;
  findEnabledAutomationsByTriggerEventName(
    eventName: string,
    userId?: string | null,
  ): Promise<AutomationRow[]>;
  createRunFromTrigger(input: {
    automationId: string;
    triggerEventId: string;
    contactId?: string | null;
    userId?: string | null;
    initialStepKey?: string;
  }): Promise<CustomEventAutomationRunRow>;
};

export type CustomEventServiceDependencies = {
  repository?: CustomEventBoundaryRepository;
  resumeWaitingRunsForEvent?: (
    delivery: CustomEventDeliveryRow,
  ) => Promise<CustomEventAutomationRunRow[]>;
};

function defaultRepository(): CustomEventBoundaryRepository {
  return {
    create: (input) => customEventRepo.create(input),
    list: (input) => customEventRepo.list(input),
    findByName: (name, userId) => customEventRepo.findByName(name, userId),
    findByIdentifierForUser: (identifier, userId) =>
      customEventRepo.findByIdentifierForUser(identifier, userId),
    updateForUser: (id, userId, input) =>
      customEventRepo.updateForUser(id, userId, input),
    deleteForUser: (id, userId) => customEventRepo.deleteForUser(id, userId),
    resolveContactId: async (input) => {
      if (!input.userId) return null;

      if (input.contactId) {
        const existing = await db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, input.contactId),
            eq(contacts.userId, input.userId),
          ),
        });
        return existing?.id ?? null;
      }
      if (!input.email) return null;

      const normalizedEmail = input.email.toLowerCase().trim();
      const existing = await db.query.contacts.findFirst({
        where: eq(contacts.email, normalizedEmail),
      });
      if (existing)
        return existing.userId === input.userId ? existing.id : null;

      const [created] = await db
        .insert(contacts)
        .values({ email: normalizedEmail, userId: input.userId })
        .returning({ id: contacts.id });
      return created.id;
    },
    recordDelivery: (input) => customEventDeliveryRepo.record(input),
    findEnabledAutomationsByTriggerEventName: (eventName, userId) =>
      automationRepo.findEnabledByTriggerEventName(eventName, userId),
    createRunFromTrigger: (input) =>
      automationRunRepo.createFromTrigger({
        automationId: input.automationId,
        triggerEventId: input.triggerEventId,
        contactId: input.contactId,
        userId: input.userId,
        initialStepKey: input.initialStepKey,
      }),
  };
}

function toCustomEventResponse(event: CustomEventRow) {
  return {
    object: "event" as const,
    id: event.id,
    name: event.name,
    schema: event.schema ?? null,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
}

function toCustomEventDeliveryResponse(delivery: CustomEventDeliveryRow) {
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

function findFailedStepKey(
  stepStates: CustomEventAutomationRunRow["stepStates"],
): string | null {
  if (!stepStates) return null;
  for (const [key, state] of Object.entries(stepStates) as Array<
    [string, StepState]
  >) {
    if (state.status === "failed") return key;
  }
  return null;
}

function durationMs(run: CustomEventAutomationRunRow): number | null {
  if (!run.startedAt || !run.completedAt) return null;
  return Math.max(0, run.completedAt.getTime() - run.startedAt.getTime());
}

function toRunListItemResponse(run: CustomEventAutomationRunRow) {
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

function schemaValidationError(
  details: EventSchemaIssue[],
): CustomEventServiceError {
  const code = details.some((detail) => detail.path.startsWith("schema"))
    ? "event_schema_invalid"
    : "event_payload_invalid";
  return new CustomEventServiceError(
    code,
    code === "event_schema_invalid"
      ? "Stored event schema is invalid"
      : "Event payload does not match schema",
    details,
  );
}

async function noopResumeWaitingRunsForEvent(): Promise<
  CustomEventAutomationRunRow[]
> {
  return [];
}

export function createCustomEventService({
  repository = defaultRepository(),
  resumeWaitingRunsForEvent = noopResumeWaitingRunsForEvent,
}: CustomEventServiceDependencies = {}) {
  return {
    async createCustomEvent(
      input: CreateCustomEventServiceInput,
    ): Promise<CustomEventResponse> {
      const event = await repository.create({
        name: input.data.name,
        schema: input.data.schema ?? null,
        userId: input.userId,
      });
      return toCustomEventResponse(event);
    },

    async listCustomEvents(
      input: ListCustomEventsServiceInput,
    ): Promise<CustomEventListResponse> {
      const { data, hasMore } = await repository.list({
        limit: input.limit ?? 50,
        after: input.after,
        userId: input.userId,
      });
      return {
        object: "list",
        data: data.map(toCustomEventResponse),
        has_more: hasMore,
      };
    },

    async getCustomEvent(
      input: GetCustomEventServiceInput,
    ): Promise<CustomEventResponse> {
      const event = await repository.findByIdentifierForUser(
        input.identifier,
        input.userId,
      );
      if (!event) {
        throw new CustomEventServiceError("not_found", "Event not found");
      }
      return toCustomEventResponse(event);
    },

    async updateCustomEvent(
      input: UpdateCustomEventServiceInput,
    ): Promise<CustomEventResponse> {
      const event = await repository.findByIdentifierForUser(
        input.identifier,
        input.userId,
      );
      if (!event) {
        throw new CustomEventServiceError("not_found", "Event not found");
      }

      const updated = await repository.updateForUser(
        event.id,
        input.userId,
        input.data,
      );
      if (!updated) {
        throw new CustomEventServiceError("not_found", "Event not found");
      }
      return toCustomEventResponse(updated);
    },

    async deleteCustomEvent(
      input: DeleteCustomEventServiceInput,
    ): Promise<CustomEventDeleteResponse> {
      const id = input.id;
      if (id !== undefined) {
        const deleted = await repository.deleteForUser(id, input.userId);
        if (deleted.length === 0) {
          throw new CustomEventServiceError("not_found", "Event not found");
        }
        return { object: "event", id: deleted[0].id, deleted: true };
      }

      const identifier = input.identifier;
      if (!identifier) {
        throw new CustomEventServiceError("not_found", "Event not found");
      }
      const event = await repository.findByIdentifierForUser(
        identifier,
        input.userId,
      );
      if (!event) {
        throw new CustomEventServiceError("not_found", "Event not found");
      }

      const deleted = await repository.deleteForUser(event.id, input.userId);
      if (deleted.length === 0) {
        throw new CustomEventServiceError("not_found", "Event not found");
      }
      return { object: "event", id: deleted[0].id, deleted: true };
    },

    async sendCustomEvent(
      input: SendCustomEventServiceInput,
    ): Promise<SendCustomEventResponse> {
      const event = input.data;
      const contactId = event.contact_id ?? event.contactId;
      const customEvent = await repository.findByName(
        event.event,
        input.userId,
      );
      const payload = event.payload ?? {};

      if (customEvent?.schema !== null && customEvent?.schema !== undefined) {
        if (!isRecord(customEvent.schema)) {
          throw new CustomEventServiceError(
            "event_schema_invalid",
            "Stored event schema is invalid",
            [{ path: "schema", message: "schema must be an object" }],
          );
        }

        const details = validateEventPayloadAgainstSchema(
          payload,
          customEvent.schema,
        );
        if (details.length > 0) throw schemaValidationError(details);
      }

      const resolvedContactId = await repository.resolveContactId({
        contactId,
        email: event.email,
        userId: input.userId,
      });
      const delivery = await repository.recordDelivery({
        eventName: event.event,
        payload,
        contactId: resolvedContactId,
        email: event.email?.toLowerCase().trim() ?? null,
        userId: input.userId,
      });
      const resumedRuns = await resumeWaitingRunsForEvent(delivery);

      const matching =
        await repository.findEnabledAutomationsByTriggerEventName(
          event.event,
          input.userId,
        );
      const runs: CustomEventAutomationRunRow[] = [];
      for (const automation of matching) {
        runs.push(
          await repository.createRunFromTrigger({
            automationId: automation.id,
            triggerEventId: delivery.id,
            contactId: resolvedContactId,
            userId: input.userId,
            initialStepKey: "trigger",
          }),
        );
      }

      return {
        object: "event_delivery",
        delivery: toCustomEventDeliveryResponse(delivery),
        resumed_runs: resumedRuns.map(toRunListItemResponse),
        automation_runs: runs.map(toRunListItemResponse),
      };
    },
  };
}
