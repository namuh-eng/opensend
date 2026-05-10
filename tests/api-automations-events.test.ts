import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockAutomationCreate = vi.hoisted(() => vi.fn());
const mockAutomationList = vi.hoisted(() => vi.fn());
const mockAutomationValidate = vi.hoisted(() => vi.fn());
const mockAutomationDelete = vi.hoisted(() => vi.fn());
const mockFindEnabledByTriggerEventName = vi.hoisted(() => vi.fn());
const mockCustomEventCreate = vi.hoisted(() => vi.fn());
const mockCustomEventFindByName = vi.hoisted(() => vi.fn());
const mockCustomEventList = vi.hoisted(() => vi.fn());
const mockDeliveryRecord = vi.hoisted(() => vi.fn());
const mockRunCreateFromTrigger = vi.hoisted(() => vi.fn());
const mockResumeWaitingRunsForEvent = vi.hoisted(() => vi.fn());
const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockDbDelete = vi.hoisted(() => vi.fn());
const mockDbTransaction = vi.hoisted(() => vi.fn());
const mockAutomationFindFirst = vi.hoisted(() => vi.fn());
const mockRunFindFirst = vi.hoisted(() => vi.fn());
const mockContactFindFirst = vi.hoisted(() => vi.fn());

class TestAutomationValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "automation_invalid") {
    super(message);
    this.name = "AutomationValidationError";
    this.code = code;
  }
}

function queryRows<T>(rows: T[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
    // biome-ignore lint/suspicious/noThenProperty: mocks Drizzle thenable builders
    then: (resolve: (value: T[]) => unknown) => Promise.resolve(resolve(rows)),
  };
}

function insertRows<T>(rows: T[]) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  };
}

function updateRows<T>(
  rows: T[],
  setCalls: Array<Record<string, unknown>> = [],
) {
  return {
    set: vi.fn((data: Record<string, unknown>) => {
      setCalls.push(data);
      return {
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue(rows),
        }),
      };
    }),
  };
}

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  unauthorizedResponse: () =>
    Response.json({ error: "Missing or invalid API key" }, { status: 401 }),
}));

vi.mock("@/lib/workers/automation-runner", () => ({
  resumeWaitingRunsForEvent: mockResumeWaitingRunsForEvent,
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      automations: { findFirst: mockAutomationFindFirst },
      automationRuns: { findFirst: mockRunFindFirst },
      contacts: { findFirst: mockContactFindFirst },
    },
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: mockDbTransaction,
  },
}));

vi.mock("@opensend/core", () => ({
  AutomationValidationError: TestAutomationValidationError,
  automationRepo: {
    create: mockAutomationCreate,
    list: mockAutomationList,
    validate: mockAutomationValidate,
    delete: mockAutomationDelete,
    update: mockDbUpdate,
    findEnabledByTriggerEventName: mockFindEnabledByTriggerEventName,
  },
  customEventRepo: {
    create: mockCustomEventCreate,
    findByName: mockCustomEventFindByName,
    list: mockCustomEventList,
  },
  customEventDeliveryRepo: {
    record: mockDeliveryRecord,
  },
  automationRunRepo: {
    createFromTrigger: mockRunCreateFromTrigger,
  },
}));

vi.mock("drizzle-orm", async () => {
  const actual = await vi.importActual("drizzle-orm");
  return {
    ...actual,
    eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
    asc: vi.fn((col: unknown) => ({ op: "asc", col })),
    desc: vi.fn((col: unknown) => ({ op: "desc", col })),
    lt: vi.fn((...args: unknown[]) => ({ op: "lt", args })),
    gte: vi.fn((...args: unknown[]) => ({ op: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ op: "lte", args })),
    inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
  };
});

const auth = {
  apiKeyId: "key_1",
  permission: "full_access",
  domain: null,
  userId: "user_1",
};
const now = new Date("2026-05-02T00:00:00.000Z");
const automation = {
  id: "auto_1",
  name: "Welcome",
  status: "enabled",
  triggerEventName: "user.signed_up",
  connections: [],
  createdAt: now,
  updatedAt: now,
};
const triggerStep = {
  id: "step_1",
  automationId: "auto_1",
  key: "trigger",
  type: "trigger",
  config: { event_name: "user.signed_up" },
  position: 0,
  createdAt: now,
  updatedAt: now,
};
const customEvent = {
  id: "evt_1",
  name: "user.signed_up",
  schema: null,
  createdAt: now,
  updatedAt: now,
};
const queuedRun = {
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
};

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: {
      Authorization: "Bearer re_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("automation API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(auth);
    mockResumeWaitingRunsForEvent.mockResolvedValue([]);
    mockDbSelect.mockReturnValue(queryRows([triggerStep]));
  });

  it("returns 401 for missing API auth", async () => {
    mockValidateApiKey.mockResolvedValue(null);
    const { GET } = await import("@/app/api/automations/route");

    const response = await GET(new Request("http://localhost/api/automations"));

    expect(response.status).toBe(401);
  });

  it("creates an automation through zod validation and repository validation", async () => {
    mockAutomationCreate.mockResolvedValue({
      automation,
      steps: [triggerStep],
    });
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        name: "Welcome",
        status: "enabled",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { eventName: "user.signed_up" },
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "auto_1",
      steps: [{ key: "trigger" }],
    });
    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1" }),
    );
  });

  it("creates an automation with a condition branch payload", async () => {
    mockAutomationCreate.mockResolvedValue({
      automation: {
        ...automation,
        connections: [
          { from: "trigger", to: "condition" },
          { from: "condition", to: "met", type: "condition_met" },
          {
            from: "condition",
            to: "not_met",
            type: "condition_not_met",
          },
        ],
      },
      steps: [
        triggerStep,
        {
          ...triggerStep,
          id: "step_condition",
          key: "condition",
          type: "condition",
          config: {
            predicate: {
              left: "event.plan",
              operator: "equals",
              right: "pro",
            },
          },
          position: 1,
        },
      ],
    });
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        name: "Branching",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
          },
          {
            key: "condition",
            type: "condition",
            config: {
              predicate: {
                left: "event.plan",
                operator: "equals",
                right: "pro",
              },
            },
          },
          { key: "met", type: "end", config: {} },
          { key: "not_met", type: "end", config: {} },
        ],
        connections: [
          { from: "trigger", to: "condition" },
          { from: "condition", to: "met", type: "condition_met" },
          {
            from: "condition",
            to: "not_met",
            type: "condition_not_met",
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        connections: expect.arrayContaining([
          { from: "condition", to: "met", type: "condition_met" },
        ]),
      }),
    );
  });

  it("creates an automation with a valid wait_for_event step", async () => {
    mockAutomationCreate.mockResolvedValue({
      automation,
      steps: [
        triggerStep,
        {
          ...triggerStep,
          id: "step_wait",
          key: "wait",
          type: "wait_for_event",
          config: { event_name: "invoice.paid", timeout_seconds: 600 },
          position: 1,
        },
      ],
    });
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        name: "Wait",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
          },
          {
            key: "wait",
            type: "wait_for_event",
            config: { event_name: "invoice.paid", timeout_seconds: 600 },
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            type: "wait_for_event",
            config: { event_name: "invoice.paid", timeout_seconds: 600 },
          }),
        ]),
      }),
    );
  });

  it("rejects invalid wait_for_event config with field-level errors", async () => {
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
          },
          {
            key: "wait",
            type: "wait_for_event",
            config: { event_name: "", timeout_seconds: 0 },
          },
        ],
      }),
    );

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.details.fieldErrors.steps).toEqual(
      expect.arrayContaining([
        expect.stringContaining("event_name"),
        expect.stringContaining("timeout_seconds"),
      ]),
    );
  });

  it("creates an automation with a valid contact_update step", async () => {
    mockAutomationCreate.mockResolvedValue({
      automation,
      steps: [
        triggerStep,
        {
          ...triggerStep,
          id: "step_update",
          key: "update",
          type: "contact_update",
          config: {
            fields: { first_name: "event.first_name", unsubscribed: true },
            properties: { plan: "event.plan" },
          },
          position: 1,
        },
      ],
    });
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        name: "Update contact",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
          },
          {
            key: "update",
            type: "contact_update",
            config: {
              fields: { first_name: "event.first_name", unsubscribed: true },
              properties: { plan: "event.plan" },
            },
          },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            type: "contact_update",
            config: {
              fields: { first_name: "event.first_name", unsubscribed: true },
              properties: { plan: "event.plan" },
            },
          }),
        ]),
      }),
    );
  });

  it("creates an automation with a valid contact_delete step", async () => {
    mockAutomationCreate.mockResolvedValue({
      automation,
      steps: [
        triggerStep,
        {
          ...triggerStep,
          id: "step_delete",
          key: "delete",
          type: "contact_delete",
          config: {},
          position: 1,
        },
      ],
    });
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        name: "Delete contact",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.deleted" },
          },
          { key: "delete", type: "contact_delete", config: {} },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: expect.arrayContaining([
          expect.objectContaining({
            type: "contact_delete",
            config: {},
          }),
        ]),
      }),
    );
  });

  it("rejects contact_delete configs with extra keys", async () => {
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.deleted" },
          },
          {
            key: "delete",
            type: "contact_delete",
            config: { reason: "spam" },
          },
        ],
      }),
    );

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.details.fieldErrors.steps).toEqual(
      expect.arrayContaining([expect.stringContaining("reason")]),
    );
  });

  it("rejects invalid contact_update config with field-level errors", async () => {
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
          },
          {
            key: "update",
            type: "contact_update",
            config: {
              fields: { segments: ["vip"] },
              properties: { unsubscribed: "event.unsubscribed" },
            },
          },
        ],
      }),
    );

    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.details.fieldErrors.steps).toEqual(
      expect.arrayContaining([
        expect.stringContaining("segments"),
        expect.stringContaining("reserved contact field"),
      ]),
    );
  });

  it("returns 422 when repository graph validation rejects condition branches", async () => {
    mockAutomationCreate.mockRejectedValue(
      new TestAutomationValidationError(
        "connection condition -> missing references unknown step key",
        "connection_unknown_step",
      ),
    );
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
          },
          {
            key: "condition",
            type: "condition",
            config: {
              predicate: {
                left: "event.plan",
                operator: "equals",
                right: "pro",
              },
            },
          },
        ],
        connections: [
          { from: "condition", to: "missing", type: "condition_met" },
        ],
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "connection_unknown_step",
    });
  });

  it("rejects invalid automation create payloads with 422", async () => {
    const { POST } = await import("@/app/api/automations/route");

    const response = await POST(
      jsonRequest("http://localhost/api/automations", {
        steps: [{ key: "x", type: "condition" }],
      }),
    );

    expect(response.status).toBe(422);
  });

  it("lists and retrieves automations", async () => {
    mockAutomationList.mockResolvedValue({
      data: [automation],
      hasMore: false,
    });
    mockAutomationFindFirst.mockResolvedValue(automation);
    const listRoute = await import("@/app/api/automations/route");
    const detailRoute = await import("@/app/api/automations/[id]/route");

    const list = await listRoute.GET(
      new Request("http://localhost/api/automations?status=enabled"),
    );
    const detail = await detailRoute.GET(
      new Request("http://localhost/api/automations/auto_1"),
      { params: Promise.resolve({ id: "auto_1" }) },
    );

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({
      id: "auto_1",
      trigger_event_name: "user.signed_up",
    });
  });

  it("cancels a queued run with reason metadata and no history loss", async () => {
    const setCalls: Array<Record<string, unknown>> = [];
    mockAutomationFindFirst.mockResolvedValue(automation);
    mockRunFindFirst.mockResolvedValue(queuedRun);
    mockDbUpdate.mockReturnValue(
      updateRows([{ ...queuedRun, status: "cancelled" }], setCalls),
    );
    const { POST } = await import(
      "@/app/api/automations/[id]/runs/[runId]/cancel/route"
    );

    const response = await POST(
      jsonRequest("http://localhost/api/automations/auto_1/runs/run_1/cancel", {
        reason: "customer requested stop",
      }),
      { params: Promise.resolve({ id: "auto_1", runId: "run_1" }) },
    );

    expect(response.status).toBe(200);
    expect(setCalls[0]).toMatchObject({
      status: "cancelled",
      nextStepAt: null,
      failureReason: "customer requested stop",
    });
    expect(setCalls[0]?.stepStates).toMatchObject({
      wait: {
        status: "cancelled",
        output: {
          waiting_for_event: "invoice.paid",
          cancellation_reason: "customer requested stop",
        },
      },
    });
    await expect(response.json()).resolves.toMatchObject({
      object: "automation_run",
      id: "run_1",
      status: "cancelled",
    });
  });

  it("rejects cancellation for terminal runs deterministically", async () => {
    mockAutomationFindFirst.mockResolvedValue(automation);
    mockRunFindFirst.mockResolvedValue({
      ...queuedRun,
      status: "completed",
      completedAt: now,
      nextStepAt: null,
    });
    const { POST } = await import(
      "@/app/api/automations/[id]/runs/[runId]/cancel/route"
    );

    const response = await POST(
      jsonRequest("http://localhost/api/automations/auto_1/runs/run_1/cancel", {
        reason: "too late",
      }),
      { params: Promise.resolve({ id: "auto_1", runId: "run_1" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "run_not_cancellable",
    });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("aggregates tenant-scoped automation run metrics", async () => {
    mockAutomationFindFirst.mockResolvedValue(automation);
    mockDbSelect.mockReturnValue(
      queryRows([
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
          failureReason: "send_email template is missing or unpublished",
          stepStates: {
            send: {
              status: "failed",
              error: "send_email template is missing or unpublished",
            },
          },
        },
        {
          ...queuedRun,
          id: "run_waiting",
          status: "waiting",
          currentStepKey: "wait",
          startedAt: null,
          completedAt: null,
        },
      ]),
    );
    const { GET } = await import(
      "@/app/api/automations/[id]/runs/metrics/route"
    );

    const response = await GET(
      new Request(
        "http://localhost/api/automations/auto_1/runs/metrics?from=2026-05-02T00%3A00%3A00.000Z&to=2026-05-03T00%3A00%3A00.000Z",
        { headers: { Authorization: "Bearer re_test" } },
      ),
      { params: Promise.resolve({ id: "auto_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      object: "automation_run_metrics",
      automation_id: "auto_1",
      total_runs: 3,
      by_status: {
        completed: 1,
        failed: 1,
        waiting: 1,
      },
      completion_rate: 1 / 3,
      failure_rate: 1 / 3,
      average_duration_ms: 20000,
      waiting_count: 1,
      failed_steps: [{ step_key: "send", count: 1 }],
      range: {
        from: "2026-05-02T00:00:00.000Z",
        to: "2026-05-03T00:00:00.000Z",
      },
    });
  });
});

describe("events API routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(auth);
    mockCustomEventFindByName.mockResolvedValue(null);
    mockResumeWaitingRunsForEvent.mockResolvedValue([]);
  });

  it("creates and lists custom events", async () => {
    mockCustomEventCreate.mockResolvedValue(customEvent);
    mockCustomEventList.mockResolvedValue({
      data: [customEvent],
      hasMore: false,
    });
    const { POST, GET } = await import("@/app/api/events/route");

    const created = await POST(
      jsonRequest("http://localhost/api/events", { name: "user.signed_up" }),
    );
    const listed = await GET(
      new Request("http://localhost/api/events", {
        headers: { Authorization: "Bearer re_test" },
      }),
    );

    expect(created.status).toBe(201);
    expect(listed.status).toBe(200);
    await expect(created.json()).resolves.toMatchObject({
      id: "evt_1",
      name: "user.signed_up",
    });
  });

  it("rejects reserved resend event names", async () => {
    mockCustomEventCreate.mockRejectedValue(
      new TestAutomationValidationError("reserved", "event_name_reserved"),
    );
    const { POST } = await import("@/app/api/events/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events", { name: "resend:bounced" }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "event_name_reserved",
    });
  });

  it("rejects invalid custom event schema definitions with 422 details", async () => {
    const { POST } = await import("@/app/api/events/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events", {
        name: "user.signed_up",
        schema: {
          type: "object",
          properties: {
            plan: { type: "text" },
          },
        },
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Validation failed",
      details: {
        fieldErrors: {
          schema: expect.arrayContaining([
            "schema.properties.plan.type must be one of: string, number, boolean, object, array",
          ]),
        },
      },
    });
    expect(mockCustomEventCreate).not.toHaveBeenCalled();
  });

  it("requires exactly one contact identifier when sending events", async () => {
    const { POST } = await import("@/app/api/events/send/route");

    const none = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
      }),
    );
    const both = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        contact_id: "11111111-1111-4111-8111-111111111111",
        email: "u@example.com",
      }),
    );

    expect(none.status).toBe(422);
    expect(both.status).toBe(422);
  });

  it("resolves email contacts, records delivery, and fans out one run per matching automation", async () => {
    mockContactFindFirst.mockResolvedValue(null);
    mockDbInsert.mockReturnValue(insertRows([{ id: "contact_1" }]));
    mockDeliveryRecord.mockResolvedValue({
      id: "delivery_1",
      eventName: "user.signed_up",
      contactId: "contact_1",
      email: "user@example.com",
      payload: { plan: "pro" },
      receivedAt: now,
    });
    mockFindEnabledByTriggerEventName.mockResolvedValue([
      { ...automation, id: "auto_1" },
      { ...automation, id: "auto_2" },
    ]);
    mockRunCreateFromTrigger
      .mockResolvedValueOnce({
        id: "run_1",
        automationId: "auto_1",
        status: "queued",
        triggerEventId: "delivery_1",
        contactId: "contact_1",
        stepStates: {},
        startedAt: null,
        completedAt: null,
        currentStepKey: "trigger",
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      })
      .mockResolvedValueOnce({
        id: "run_2",
        automationId: "auto_2",
        status: "queued",
        triggerEventId: "delivery_1",
        contactId: "contact_1",
        stepStates: {},
        startedAt: null,
        completedAt: null,
        currentStepKey: "trigger",
        failureReason: null,
        createdAt: now,
        updatedAt: now,
      });
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        email: "USER@example.com",
        payload: { plan: "pro" },
      }),
    );

    expect(response.status).toBe(202);
    const json = await response.json();
    expect(json.automation_runs).toHaveLength(2);
    expect(mockFindEnabledByTriggerEventName).toHaveBeenCalledWith(
      "user.signed_up",
      "user_1",
    );
    expect(mockResumeWaitingRunsForEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "delivery_1" }),
    );
    expect(mockRunCreateFromTrigger).toHaveBeenCalledTimes(2);
  });

  it("validates a payload against a stored custom event schema before recording delivery", async () => {
    mockCustomEventFindByName.mockResolvedValue({
      ...customEvent,
      schema: {
        type: "object",
        required: ["plan", "trial"],
        properties: {
          plan: { type: "string" },
          seats: { type: "number" },
          trial: { type: "boolean" },
        },
      },
    });
    mockContactFindFirst.mockResolvedValue({ id: "contact_1" });
    mockDeliveryRecord.mockResolvedValue({
      id: "delivery_1",
      eventName: "user.signed_up",
      contactId: "contact_1",
      email: "user@example.com",
      payload: { plan: "pro", seats: 3, trial: false },
      receivedAt: now,
    });
    mockFindEnabledByTriggerEventName.mockResolvedValue([
      { ...automation, id: "auto_1" },
    ]);
    mockRunCreateFromTrigger.mockResolvedValue({
      id: "run_1",
      automationId: "auto_1",
      status: "queued",
      triggerEventId: "delivery_1",
      contactId: "contact_1",
      stepStates: {},
      startedAt: null,
      completedAt: null,
      currentStepKey: "trigger",
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    });
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        email: "user@example.com",
        payload: { plan: "pro", seats: 3, trial: false },
      }),
    );

    expect(response.status).toBe(202);
    expect(mockCustomEventFindByName).toHaveBeenCalledWith(
      "user.signed_up",
      "user_1",
    );
    expect(mockDeliveryRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { plan: "pro", seats: 3, trial: false },
      }),
    );
    expect(mockRunCreateFromTrigger).toHaveBeenCalledTimes(1);
  });

  it("returns 422 path details and creates no delivery or runs when schema validation fails", async () => {
    mockCustomEventFindByName.mockResolvedValue({
      ...customEvent,
      schema: {
        type: "object",
        required: ["plan", "trial"],
        properties: {
          plan: { type: "string" },
          trial: { type: "boolean" },
        },
      },
    });
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        email: "user@example.com",
        payload: { plan: 42 },
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      code: "event_payload_invalid",
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
    expect(mockContactFindFirst).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockDeliveryRecord).not.toHaveBeenCalled();
    expect(mockResumeWaitingRunsForEvent).not.toHaveBeenCalled();
    expect(mockFindEnabledByTriggerEventName).not.toHaveBeenCalled();
    expect(mockRunCreateFromTrigger).not.toHaveBeenCalled();
  });

  it("keeps schema-less custom events accepting arbitrary object payloads", async () => {
    mockCustomEventFindByName.mockResolvedValue({
      ...customEvent,
      schema: null,
    });
    mockContactFindFirst.mockResolvedValue({ id: "contact_1" });
    mockDeliveryRecord.mockResolvedValue({
      id: "delivery_1",
      eventName: "user.signed_up",
      contactId: "contact_1",
      email: "user@example.com",
      payload: { nested: { ok: true }, extra: ["anything"] },
      receivedAt: now,
    });
    mockFindEnabledByTriggerEventName.mockResolvedValue([]);
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        email: "user@example.com",
        payload: { nested: { ok: true }, extra: ["anything"] },
      }),
    );

    expect(response.status).toBe(202);
    expect(mockDeliveryRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { nested: { ok: true }, extra: ["anything"] },
      }),
    );
  });

  it("documents current-compatible unknown event names as schema-less sends", async () => {
    mockCustomEventFindByName.mockResolvedValue(null);
    mockContactFindFirst.mockResolvedValue({ id: "contact_1" });
    mockDeliveryRecord.mockResolvedValue({
      id: "delivery_unknown",
      eventName: "unknown.event",
      contactId: "contact_1",
      email: "user@example.com",
      payload: { arbitrary: true },
      receivedAt: now,
    });
    mockFindEnabledByTriggerEventName.mockResolvedValue([]);
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "unknown.event",
        email: "user@example.com",
        payload: { arbitrary: true },
      }),
    );

    expect(response.status).toBe(202);
    expect(mockCustomEventFindByName).toHaveBeenCalledWith(
      "unknown.event",
      "user_1",
    );
    expect(mockDeliveryRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "unknown.event",
        payload: { arbitrary: true },
      }),
    );
  });

  it("includes wait_for_event resumed runs when sending a matching event", async () => {
    mockContactFindFirst.mockResolvedValue({ id: "contact_1" });
    mockDeliveryRecord.mockResolvedValue({
      id: "delivery_1",
      eventName: "invoice.paid",
      contactId: "contact_1",
      email: "user@example.com",
      payload: { invoice_id: "inv_1" },
      receivedAt: now,
    });
    mockResumeWaitingRunsForEvent.mockResolvedValue([
      {
        id: "run_wait",
        automationId: "auto_1",
        status: "queued",
        triggerEventId: "trigger_delivery",
        contactId: "contact_1",
        stepStates: {
          wait: {
            status: "completed",
            output: {
              waited_event: {
                delivery_id: "delivery_1",
                payload: { invoice_id: "inv_1" },
              },
            },
          },
        },
        startedAt: now,
        completedAt: null,
        currentStepKey: "send",
        failureReason: null,
        nextStepAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockFindEnabledByTriggerEventName.mockResolvedValue([]);
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "invoice.paid",
        contact_id: "11111111-1111-4111-8111-111111111111",
        payload: { invoice_id: "inv_1" },
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      resumed_runs: [{ id: "run_wait", current_step_key: "send" }],
      automation_runs: [],
    });
  });
});
