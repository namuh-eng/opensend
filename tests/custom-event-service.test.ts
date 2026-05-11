import {
  type CustomEventAutomationRunRow,
  type CustomEventBoundaryRepository,
  type CustomEventDeliveryRow,
  type CustomEventRow,
  CustomEventServiceError,
  createCustomEventService,
} from "@opensend/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AutomationRow = Awaited<
  ReturnType<
    CustomEventBoundaryRepository["findEnabledAutomationsByTriggerEventName"]
  >
>[number];

type RecordDeliveryInput = Parameters<
  CustomEventBoundaryRepository["recordDelivery"]
>[0];

type CreateRunInput = Parameters<
  CustomEventBoundaryRepository["createRunFromTrigger"]
>[0];

const now = new Date("2026-05-02T00:00:00.000Z");

const customEvent: CustomEventRow = {
  id: "evt_1",
  name: "user.signed_up",
  schema: null,
  createdAt: now,
  updatedAt: now,
  userId: "user_1",
};

const delivery: CustomEventDeliveryRow = {
  id: "delivery_1",
  eventName: "user.signed_up",
  contactId: "contact_1",
  email: "user@example.com",
  payload: { plan: "pro" },
  receivedAt: now,
  userId: "user_1",
};

const automation: AutomationRow = {
  id: "auto_1",
  name: "Welcome",
  status: "enabled",
  triggerEventName: "user.signed_up",
  connections: [],
  createdAt: now,
  updatedAt: now,
  document: null,
  userId: "user_1",
};

const run: CustomEventAutomationRunRow = {
  id: "run_1",
  automationId: "auto_1",
  triggerEventId: "delivery_1",
  contactId: "contact_1",
  status: "queued",
  currentStepKey: "trigger",
  stepStates: {},
  startedAt: null,
  completedAt: null,
  nextStepAt: null,
  failureReason: null,
  createdAt: now,
  updatedAt: now,
  userId: "user_1",
};

function makeRepository(
  overrides: Partial<CustomEventBoundaryRepository> = {},
): CustomEventBoundaryRepository {
  const repository: CustomEventBoundaryRepository = {
    create: vi.fn(async (input) => ({
      ...customEvent,
      name: input.name,
      schema: input.schema ?? null,
      userId: input.userId ?? null,
    })),
    list: vi.fn(async () => ({ data: [customEvent], hasMore: false })),
    findByName: vi.fn(async () => customEvent),
    deleteForUser: vi.fn(async (id) => [{ id }]),
    resolveContactId: vi.fn(async (input) => input.contactId ?? "contact_1"),
    recordDelivery: vi.fn(async (input) => ({
      ...delivery,
      eventName: input.eventName,
      payload: input.payload,
      contactId: input.contactId ?? null,
      email: input.email ?? null,
      userId: input.userId ?? null,
    })),
    findEnabledAutomationsByTriggerEventName: vi.fn(async () => [automation]),
    createRunFromTrigger: vi.fn(async (input) => ({
      ...run,
      automationId: input.automationId,
      triggerEventId: input.triggerEventId,
      contactId: input.contactId ?? null,
      userId: input.userId ?? null,
    })),
  };

  return { ...repository, ...overrides };
}

describe("custom event service boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, lists, and deletes custom events with caller scope and public response shapes", async () => {
    const repository = makeRepository();
    const service = createCustomEventService({ repository });

    await expect(
      service.createCustomEvent({
        userId: "user_1",
        data: { name: "user.signed_up", schema: { type: "object" } },
      }),
    ).resolves.toMatchObject({
      object: "event",
      id: "evt_1",
      name: "user.signed_up",
      schema: { type: "object" },
    });

    await expect(
      service.listCustomEvents({ userId: "user_1", limit: 10, after: "evt_0" }),
    ).resolves.toMatchObject({ object: "list", data: [{ id: "evt_1" }] });

    await expect(
      service.deleteCustomEvent({ userId: "user_1", id: "evt_1" }),
    ).resolves.toEqual({ object: "event", id: "evt_1", deleted: true });

    expect(repository.create).toHaveBeenCalledWith({
      name: "user.signed_up",
      schema: { type: "object" },
      userId: "user_1",
    });
    expect(repository.list).toHaveBeenCalledWith({
      limit: 10,
      after: "evt_0",
      userId: "user_1",
    });
    expect(repository.deleteForUser).toHaveBeenCalledWith("evt_1", "user_1");
  });

  it("reports missing deletes without leaking cross-tenant existence", async () => {
    const service = createCustomEventService({
      repository: makeRepository({ deleteForUser: vi.fn(async () => []) }),
    });

    await expect(
      service.deleteCustomEvent({ userId: "user_2", id: "evt_1" }),
    ).rejects.toMatchObject({ code: "not_found", message: "Event not found" });
  });

  it("validates stored schemas before contact resolution, records delivery, resumes waiters, and fans out runs", async () => {
    let capturedDelivery: RecordDeliveryInput | undefined;
    let capturedRun: CreateRunInput | undefined;
    const resumedRun = { ...run, id: "run_wait", currentStepKey: "send" };
    const repository = makeRepository({
      findByName: vi.fn(async () => ({
        ...customEvent,
        schema: {
          type: "object",
          required: ["plan"],
          properties: { plan: { type: "string" } },
        },
      })),
      recordDelivery: vi.fn(async (input) => {
        capturedDelivery = input;
        return { ...delivery, payload: input.payload };
      }),
      createRunFromTrigger: vi.fn(async (input) => {
        capturedRun = input;
        return run;
      }),
    });
    const resumeWaitingRunsForEvent = vi.fn(async () => [resumedRun]);
    const service = createCustomEventService({
      repository,
      resumeWaitingRunsForEvent,
    });

    const result = await service.sendCustomEvent({
      userId: "user_1",
      data: {
        event: "user.signed_up",
        email: "USER@example.com",
        payload: { plan: "pro" },
      },
    });

    expect(repository.findByName).toHaveBeenCalledWith(
      "user.signed_up",
      "user_1",
    );
    expect(repository.resolveContactId).toHaveBeenCalledWith({
      contactId: undefined,
      email: "USER@example.com",
      userId: "user_1",
    });
    expect(capturedDelivery).toMatchObject({
      eventName: "user.signed_up",
      payload: { plan: "pro" },
      contactId: "contact_1",
      email: "user@example.com",
      userId: "user_1",
    });
    expect(resumeWaitingRunsForEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "delivery_1" }),
    );
    expect(
      repository.findEnabledAutomationsByTriggerEventName,
    ).toHaveBeenCalledWith("user.signed_up", "user_1");
    expect(capturedRun).toMatchObject({
      automationId: "auto_1",
      triggerEventId: "delivery_1",
      contactId: "contact_1",
      userId: "user_1",
      initialStepKey: "trigger",
    });
    expect(result).toMatchObject({
      object: "event_delivery",
      delivery: { event: "user.signed_up", email: "user@example.com" },
      resumed_runs: [{ id: "run_wait", current_step_key: "send" }],
      automation_runs: [{ id: "run_1", current_step_key: "trigger" }],
    });
  });

  it("returns payload validation details and stops before side effects", async () => {
    const repository = makeRepository({
      findByName: vi.fn(async () => ({
        ...customEvent,
        schema: {
          type: "object",
          required: ["plan", "trial"],
          properties: {
            plan: { type: "string" },
            trial: { type: "boolean" },
          },
        },
      })),
    });
    const service = createCustomEventService({ repository });

    await expect(
      service.sendCustomEvent({
        userId: "user_1",
        data: {
          event: "user.signed_up",
          email: "user@example.com",
          payload: { plan: 42 },
        },
      }),
    ).rejects.toMatchObject({
      code: "event_payload_invalid",
      message: "Event payload does not match schema",
      details: expect.arrayContaining([
        {
          path: "payload.plan",
          message: 'Expected payload.plan to be "string"',
        },
        {
          path: "payload.trial",
          message: "Missing required field payload.trial",
        },
      ]),
    });
    expect(repository.resolveContactId).not.toHaveBeenCalled();
    expect(repository.recordDelivery).not.toHaveBeenCalled();
    expect(
      repository.findEnabledAutomationsByTriggerEventName,
    ).not.toHaveBeenCalled();
    expect(repository.createRunFromTrigger).not.toHaveBeenCalled();
  });

  it("keeps unknown event names schema-less and accepts arbitrary object payloads", async () => {
    const repository = makeRepository({
      findByName: vi.fn(async () => undefined),
      findEnabledAutomationsByTriggerEventName: vi.fn(async () => []),
    });
    const service = createCustomEventService({ repository });

    await expect(
      service.sendCustomEvent({
        userId: "user_1",
        data: {
          event: "unknown.event",
          contact_id: "11111111-1111-4111-8111-111111111111",
          payload: { arbitrary: true },
        },
      }),
    ).resolves.toMatchObject({
      object: "event_delivery",
      automation_runs: [],
    });
    expect(repository.recordDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "unknown.event",
        payload: { arbitrary: true },
        contactId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("classifies invalid stored schema rows as event_schema_invalid", async () => {
    const service = createCustomEventService({
      repository: makeRepository({
        findByName: vi.fn(async () => ({ ...customEvent, schema: [] })),
      }),
    });

    await expect(
      service.sendCustomEvent({
        userId: "user_1",
        data: { event: "user.signed_up", email: "user@example.com" },
      }),
    ).rejects.toBeInstanceOf(CustomEventServiceError);
    await expect(
      service.sendCustomEvent({
        userId: "user_1",
        data: { event: "user.signed_up", email: "user@example.com" },
      }),
    ).rejects.toMatchObject({
      code: "event_schema_invalid",
      details: [{ path: "schema", message: "schema must be an object" }],
    });
  });
});
