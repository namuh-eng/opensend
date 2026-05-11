import type {
  CreateAutomationServiceInput,
  ListAutomationsServiceInput,
} from "@opensend/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateApiKey = vi.hoisted(() => vi.fn());
const mockAuthorizeDashboardOrApiKey = vi.hoisted(() => vi.fn());
const mockGetServerSession = vi.hoisted(() => vi.fn());
const mockAutomationCreate = vi.hoisted(() => vi.fn());
const mockAutomationList = vi.hoisted(() => vi.fn());
const mockServiceCreateAutomation = vi.hoisted(() => vi.fn());
const mockServiceListAutomations = vi.hoisted(() => vi.fn());
const mockServiceGetAutomation = vi.hoisted(() => vi.fn());
const mockServiceUpdateAutomation = vi.hoisted(() => vi.fn());
const mockServiceDeleteAutomation = vi.hoisted(() => vi.fn());
const mockServiceCreateCustomEvent = vi.hoisted(() => vi.fn());
const mockServiceListCustomEvents = vi.hoisted(() => vi.fn());
const mockServiceDeleteCustomEvent = vi.hoisted(() => vi.fn());
const mockServiceSendCustomEvent = vi.hoisted(() => vi.fn());
const mockAutomationValidate = vi.hoisted(() => vi.fn());
const mockAutomationDelete = vi.hoisted(() => vi.fn());
const mockFindEnabledByTriggerEventName = vi.hoisted(() => vi.fn());
const mockCustomEventCreate = vi.hoisted(() => vi.fn());
const mockCustomEventFindByName = vi.hoisted(() => vi.fn());
const mockCustomEventList = vi.hoisted(() => vi.fn());
const mockDeliveryRecord = vi.hoisted(() => vi.fn());
const mockRunCreateFromTrigger = vi.hoisted(() => vi.fn());
const mockListRuns = vi.hoisted(() => vi.fn());
const mockGetRun = vi.hoisted(() => vi.fn());
const mockCancelRun = vi.hoisted(() => vi.fn());
const mockGetMetrics = vi.hoisted(() => vi.fn());
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

class TestAutomationRunServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AutomationRunServiceError";
    this.code = code;
  }
}

class TestAutomationServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AutomationServiceError";
    this.code = code;
  }
}

class TestCustomEventServiceError extends Error {
  readonly code: string;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(
    code: string,
    message: string,
    details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "CustomEventServiceError";
    this.code = code;
    this.details = details;
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

vi.mock("@/lib/api-auth", () => ({
  validateApiKey: mockValidateApiKey,
  authorizeDashboardOrApiKey: mockAuthorizeDashboardOrApiKey,
  getServerSession: mockGetServerSession,
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
  AutomationRunServiceError: TestAutomationRunServiceError,
  AutomationServiceError: TestAutomationServiceError,
  CustomEventServiceError: TestCustomEventServiceError,
  isRecord: (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value),
  validateCustomEventSchemaDefinition: (schema: Record<string, unknown>) => {
    const propertyTypes = ["string", "number", "boolean", "object", "array"];
    const issues: Array<{ path: string; message: string }> = [];
    if (schema.type !== "object") {
      issues.push({
        path: "schema.type",
        message: 'schema.type must be "object"',
      });
      return issues;
    }
    const properties = schema.properties;
    if (
      typeof properties === "object" &&
      properties !== null &&
      !Array.isArray(properties)
    ) {
      for (const [name, descriptor] of Object.entries(properties)) {
        if (
          typeof descriptor === "object" &&
          descriptor !== null &&
          !Array.isArray(descriptor) &&
          !propertyTypes.includes(String(descriptor.type))
        ) {
          issues.push({
            path: `schema.properties.${name}.type`,
            message: `schema.properties.${name}.type must be one of: ${propertyTypes.join(", ")}`,
          });
        }
      }
    }
    return issues;
  },
  validateEventPayloadAgainstSchema: () => [],
  createAutomationService: () => ({
    createAutomation: mockServiceCreateAutomation,
    listAutomations: mockServiceListAutomations,
    getAutomation: mockServiceGetAutomation,
    updateAutomation: mockServiceUpdateAutomation,
    deleteAutomation: mockServiceDeleteAutomation,
  }),
  createAutomationRunService: () => ({
    listRuns: mockListRuns,
    getRun: mockGetRun,
    cancelRun: mockCancelRun,
    getMetrics: mockGetMetrics,
  }),
  createCustomEventService: () => ({
    createCustomEvent: mockServiceCreateCustomEvent,
    listCustomEvents: mockServiceListCustomEvents,
    deleteCustomEvent: mockServiceDeleteCustomEvent,
    sendCustomEvent: mockServiceSendCustomEvent,
  }),
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
type TestCreatedAutomation = {
  automation: typeof automation;
  steps: Array<typeof triggerStep>;
};

type TestAutomationListResult = {
  data: Array<typeof automation>;
  hasMore: boolean;
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
      Authorization: "Bearer os_test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function dashboardJsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    method,
    headers: {
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
    mockAuthorizeDashboardOrApiKey.mockResolvedValue(auth);
    mockGetServerSession.mockResolvedValue({
      session: { id: "session_1" },
      user: { id: "user_1" },
    });
    mockResumeWaitingRunsForEvent.mockResolvedValue([]);
    mockDbSelect.mockReturnValue(queryRows([triggerStep]));
    mockServiceCreateAutomation.mockImplementation(
      async (input: CreateAutomationServiceInput) => {
        const created = (await mockAutomationCreate({
          name: input.data.name,
          status: input.data.status,
          triggerEventName:
            input.data.trigger_event_name ?? input.data.triggerEventName,
          steps: input.data.steps.map((step) => ({
            key: step.key,
            type: step.type,
            config: step.config ?? {},
            position: step.position,
          })),
          connections: input.data.connections,
          userId: input.userId,
        })) as TestCreatedAutomation;
        return {
          object: "automation",
          id: created.automation.id,
          name: created.automation.name,
          status: created.automation.status,
          trigger_event_name: created.automation.triggerEventName,
          connections: created.automation.connections ?? [],
          steps: created.steps.map((step) => ({
            id: step.id,
            key: step.key,
            type: step.type,
            config: step.config ?? {},
            position: step.position,
          })),
          created_at: created.automation.createdAt,
          updated_at: created.automation.updatedAt,
        };
      },
    );
    mockServiceListAutomations.mockImplementation(
      async (input: ListAutomationsServiceInput) => {
        const listed = (await mockAutomationList({
          userId: input.userId,
          limit: input.limit ?? 25,
          after: input.after,
          status: input.status,
          search: input.search,
        })) as TestAutomationListResult;
        return {
          object: "list",
          data: listed.data.map((item) => ({
            object: "automation",
            id: item.id,
            name: item.name,
            status: item.status,
            trigger_event_name: item.triggerEventName,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
            step_count: 1,
            last_run: null,
          })),
          has_more: listed.hasMore,
        };
      },
    );
    mockServiceGetAutomation.mockImplementation(async (_userId, id) => {
      const found = await mockAutomationFindFirst({ id });
      if (!found) {
        throw new TestAutomationServiceError(
          "not_found",
          "Automation not found",
        );
      }
      return {
        object: "automation",
        id: found.id,
        name: found.name,
        status: found.status,
        trigger_event_name: found.triggerEventName,
        connections: found.connections ?? [],
        steps: [
          {
            id: triggerStep.id,
            key: triggerStep.key,
            type: triggerStep.type,
            config: triggerStep.config,
            position: triggerStep.position,
          },
        ],
        created_at: found.createdAt,
        updated_at: found.updatedAt,
      };
    });
  });

  it("returns 401 for missing API auth", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue(null);
    const { GET } = await import("@/app/api/automations/route");

    const response = await GET(new Request("http://localhost/api/automations"));

    expect(response.status).toBe(401);
  });

  it("preserves full-access enforcement for bearer API-key callers", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({
      ...auth,
      permission: "sending_access",
    });
    const { GET } = await import("@/app/api/automations/route");

    const response = await GET(
      new Request("http://localhost/api/automations", {
        headers: { Authorization: "Bearer os_sending" },
      }),
    );

    expect(response.status).toBe(403);
    expect(mockAutomationList).not.toHaveBeenCalled();
  });

  it("allows dashboard-session auth for automation CRUD and run routes without a bearer key", async () => {
    mockAuthorizeDashboardOrApiKey.mockResolvedValue({ dashboard: true });
    mockAutomationCreate.mockResolvedValue({
      automation,
      steps: [triggerStep],
    });
    mockAutomationList.mockResolvedValue({
      data: [automation],
      hasMore: false,
    });
    mockAutomationFindFirst.mockResolvedValue(automation);
    mockServiceUpdateAutomation.mockResolvedValue({
      object: "automation",
      id: "auto_1",
      name: "Welcome",
      status: "disabled",
      trigger_event_name: "user.signed_up",
      connections: [],
      steps: [{ id: "step_1", key: "trigger", type: "trigger", position: 0 }],
      created_at: now,
      updated_at: now,
    });
    mockServiceDeleteAutomation.mockResolvedValue({
      object: "automation",
      id: "auto_1",
      deleted: true,
    });
    mockListRuns.mockResolvedValue({
      object: "list",
      data: [{ object: "automation_run", id: "run_1", status: "queued" }],
      has_more: false,
    });
    mockGetRun.mockResolvedValue({
      object: "automation_run",
      id: "run_1",
      automation_id: "auto_1",
      status: "queued",
    });
    mockCancelRun.mockResolvedValue({
      object: "automation_run",
      id: "run_1",
      automation_id: "auto_1",
      status: "cancelled",
    });
    mockGetMetrics.mockResolvedValue({
      object: "automation_run_metrics",
      automation_id: "auto_1",
      total_runs: 1,
      by_status: { queued: 1 },
      completion_rate: 0,
      failure_rate: 0,
      average_duration_ms: null,
      waiting_count: 0,
      failed_steps: [],
      range: { from: null, to: null },
    });

    const listRoute = await import("@/app/api/automations/route");
    const detailRoute = await import("@/app/api/automations/[id]/route");
    const runsRoute = await import("@/app/api/automations/[id]/runs/route");
    const runDetailRoute = await import(
      "@/app/api/automations/[id]/runs/[runId]/route"
    );
    const runCancelRoute = await import(
      "@/app/api/automations/[id]/runs/[runId]/cancel/route"
    );
    const metricsRoute = await import(
      "@/app/api/automations/[id]/runs/metrics/route"
    );

    const create = await listRoute.POST(
      dashboardJsonRequest("http://localhost/api/automations", {
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
    const list = await listRoute.GET(
      new Request("http://localhost/api/automations?status=enabled"),
    );
    const detail = await detailRoute.GET(
      new Request("http://localhost/api/automations/auto_1"),
      { params: Promise.resolve({ id: "auto_1" }) },
    );
    const update = await detailRoute.PATCH(
      dashboardJsonRequest(
        "http://localhost/api/automations/auto_1",
        { status: "disabled" },
        "PATCH",
      ),
      { params: Promise.resolve({ id: "auto_1" }) },
    );
    const runList = await runsRoute.GET(
      new Request("http://localhost/api/automations/auto_1/runs"),
      { params: Promise.resolve({ id: "auto_1" }) },
    );
    const runDetail = await runDetailRoute.GET(
      new Request("http://localhost/api/automations/auto_1/runs/run_1"),
      { params: Promise.resolve({ id: "auto_1", runId: "run_1" }) },
    );
    const runCancel = await runCancelRoute.POST(
      dashboardJsonRequest(
        "http://localhost/api/automations/auto_1/runs/run_1/cancel",
        { reason: "cancelled_from_dashboard" },
      ),
      { params: Promise.resolve({ id: "auto_1", runId: "run_1" }) },
    );
    const metrics = await metricsRoute.GET(
      new Request("http://localhost/api/automations/auto_1/runs/metrics"),
      { params: Promise.resolve({ id: "auto_1" }) },
    );
    const deleted = await detailRoute.DELETE(
      new Request("http://localhost/api/automations/auto_1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "auto_1" }) },
    );

    expect([
      create.status,
      list.status,
      detail.status,
      update.status,
      runList.status,
      runDetail.status,
      runCancel.status,
      metrics.status,
      deleted.status,
    ]).toEqual([201, 200, 200, 200, 200, 200, 200, 200, 200]);
    expect(mockAutomationCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1" }),
    );
    expect(mockAutomationList).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1" }),
    );
    expect(mockServiceUpdateAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", id: "auto_1" }),
    );
    expect(mockServiceDeleteAutomation).toHaveBeenCalledWith(
      "user_1",
      "auto_1",
    );
    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ automationId: "auto_1", userId: "user_1" }),
    );
    expect(mockGetRun).toHaveBeenCalledWith({
      automationId: "auto_1",
      runId: "run_1",
      userId: "user_1",
    });
    expect(mockCancelRun).toHaveBeenCalledWith({
      automationId: "auto_1",
      runId: "run_1",
      userId: "user_1",
      reason: "cancelled_from_dashboard",
    });
    expect(mockGetMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        automationId: "auto_1",
        userId: "user_1",
      }),
    );
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

  it("lists automation runs through the service boundary", async () => {
    mockListRuns.mockResolvedValue({
      object: "list",
      data: [{ object: "automation_run", id: "run_1", status: "queued" }],
      has_more: false,
    });
    const { GET } = await import("@/app/api/automations/[id]/runs/route");

    const response = await GET(
      new Request(
        "http://localhost/api/automations/auto_1/runs?status=queued,waiting&limit=10",
        { headers: { Authorization: "Bearer os_test" } },
      ),
      { params: Promise.resolve({ id: "auto_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockListRuns).toHaveBeenCalledWith({
      automationId: "auto_1",
      userId: "user_1",
      status: "queued,waiting",
      limit: 10,
    });
    await expect(response.json()).resolves.toMatchObject({
      object: "list",
      data: [{ id: "run_1" }],
    });
  });

  it("retrieves an automation run through the service boundary", async () => {
    mockGetRun.mockResolvedValue({
      object: "automation_run",
      id: "run_1",
      automation_id: "auto_1",
      status: "queued",
    });
    const { GET } = await import(
      "@/app/api/automations/[id]/runs/[runId]/route"
    );

    const response = await GET(
      new Request("http://localhost/api/automations/auto_1/runs/run_1", {
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ id: "auto_1", runId: "run_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockGetRun).toHaveBeenCalledWith({
      automationId: "auto_1",
      runId: "run_1",
      userId: "user_1",
    });
    await expect(response.json()).resolves.toMatchObject({ id: "run_1" });
  });

  it("cancels a queued run through the service boundary", async () => {
    mockCancelRun.mockResolvedValue({
      object: "automation_run",
      id: "run_1",
      automation_id: "auto_1",
      status: "cancelled",
    });
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
    expect(mockCancelRun).toHaveBeenCalledWith({
      automationId: "auto_1",
      runId: "run_1",
      userId: "user_1",
      reason: "customer requested stop",
    });
    await expect(response.json()).resolves.toMatchObject({
      object: "automation_run",
      id: "run_1",
      status: "cancelled",
    });
  });

  it("rejects cancellation for terminal runs deterministically", async () => {
    mockCancelRun.mockRejectedValue(
      new TestAutomationRunServiceError(
        "run_not_cancellable",
        "Run is not cancellable",
      ),
    );
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
    expect(mockCancelRun).toHaveBeenCalledWith({
      automationId: "auto_1",
      runId: "run_1",
      userId: "user_1",
      reason: "too late",
    });
  });

  it("aggregates tenant-scoped automation run metrics", async () => {
    mockGetMetrics.mockResolvedValue({
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
        from: "2026-05-02T00:00:00.000Z",
        to: "2026-05-03T00:00:00.000Z",
      },
    });
    const { GET } = await import(
      "@/app/api/automations/[id]/runs/metrics/route"
    );

    const response = await GET(
      new Request(
        "http://localhost/api/automations/auto_1/runs/metrics?from=2026-05-02T00%3A00%3A00.000Z&to=2026-05-03T00%3A00%3A00.000Z",
        { headers: { Authorization: "Bearer os_test" } },
      ),
      { params: Promise.resolve({ id: "auto_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockGetMetrics).toHaveBeenCalledWith({
      automationId: "auto_1",
      userId: "user_1",
      from: new Date("2026-05-02T00:00:00.000Z"),
      to: new Date("2026-05-03T00:00:00.000Z"),
    });
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

  it("maps missing automation run service errors to 404", async () => {
    mockGetRun.mockRejectedValue(
      new TestAutomationRunServiceError("run_not_found", "Run not found"),
    );
    const { GET } = await import(
      "@/app/api/automations/[id]/runs/[runId]/route"
    );

    const response = await GET(
      new Request("http://localhost/api/automations/auto_1/runs/missing", {
        headers: { Authorization: "Bearer os_test" },
      }),
      { params: Promise.resolve({ id: "auto_1", runId: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Run not found" });
  });
});

describe("events API routes", () => {
  const eventResponse = {
    object: "event",
    id: "evt_1",
    name: "user.signed_up",
    schema: null,
    created_at: now,
    updated_at: now,
  };
  const deliveryResponse = {
    object: "event_delivery",
    id: "delivery_1",
    event: "user.signed_up",
    contact_id: "contact_1",
    email: "user@example.com",
    payload: { plan: "pro" },
    received_at: now,
  };
  const runResponse = {
    object: "automation_run",
    id: "run_1",
    automation_id: "auto_1",
    status: "queued",
    started_at: null,
    completed_at: null,
    duration_ms: null,
    current_step_key: "trigger",
    failed_step_key: null,
    failure_reason: null,
    next_step_at: null,
    created_at: now,
    updated_at: now,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue(auth);
    mockServiceCreateCustomEvent.mockResolvedValue(eventResponse);
    mockServiceListCustomEvents.mockResolvedValue({
      object: "list",
      data: [
        {
          ...eventResponse,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
      has_more: false,
    });
    mockServiceDeleteCustomEvent.mockResolvedValue({
      object: "event",
      id: "evt_1",
      deleted: true,
    });
    mockServiceSendCustomEvent.mockResolvedValue({
      object: "event_delivery",
      delivery: deliveryResponse,
      resumed_runs: [],
      automation_runs: [runResponse],
    });
  });

  it("creates and lists custom events through the service boundary", async () => {
    const { POST, GET } = await import("@/app/api/events/route");

    const created = await POST(
      jsonRequest("http://localhost/api/events", { name: "user.signed_up" }),
    );
    const listed = await GET(
      new Request("http://localhost/api/events?limit=10&after=evt_0", {
        headers: { Authorization: "Bearer os_test" },
      }),
    );

    expect(created.status).toBe(201);
    expect(listed.status).toBe(200);
    expect(mockServiceCreateCustomEvent).toHaveBeenCalledWith({
      userId: "user_1",
      data: { name: "user.signed_up" },
    });
    expect(mockServiceListCustomEvents).toHaveBeenCalledWith({
      userId: "user_1",
      limit: 10,
      after: "evt_0",
    });
    await expect(created.json()).resolves.toMatchObject({
      ...eventResponse,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
    await expect(listed.json()).resolves.toMatchObject({
      object: "list",
      data: [
        {
          ...eventResponse,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
      has_more: false,
    });
  });

  it("deletes custom events through the service boundary", async () => {
    const { DELETE } = await import("@/app/api/events/route");

    const response = await DELETE(
      new Request("http://localhost/api/events?id=evt_1", {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockServiceDeleteCustomEvent).toHaveBeenCalledWith({
      userId: "user_1",
      id: "evt_1",
    });
    await expect(response.json()).resolves.toEqual({
      object: "event",
      id: "evt_1",
      deleted: true,
    });
  });

  it("maps missing custom event deletes to 404", async () => {
    mockServiceDeleteCustomEvent.mockRejectedValue(
      new TestCustomEventServiceError("not_found", "Event not found"),
    );
    const { DELETE } = await import("@/app/api/events/route");

    const response = await DELETE(
      new Request("http://localhost/api/events?id=missing", {
        method: "DELETE",
        headers: { Authorization: "Bearer os_test" },
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Event not found",
    });
  });

  it("rejects reserved resend event names with the preserved 422 envelope", async () => {
    mockServiceCreateCustomEvent.mockRejectedValue(
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

  it("rejects invalid custom event schema definitions before calling the service", async () => {
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
    expect(mockServiceCreateCustomEvent).not.toHaveBeenCalled();
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
    expect(mockServiceSendCustomEvent).not.toHaveBeenCalled();
  });

  it("sends custom events through the service boundary and preserves the 202 response shape", async () => {
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        email: "USER@example.com",
        payload: { plan: "pro" },
      }),
    );

    expect(response.status).toBe(202);
    expect(mockServiceSendCustomEvent).toHaveBeenCalledWith({
      userId: "user_1",
      data: {
        event: "user.signed_up",
        email: "USER@example.com",
        payload: { plan: "pro" },
      },
    });
    await expect(response.json()).resolves.toEqual({
      object: "event_delivery",
      delivery: { ...deliveryResponse, received_at: now.toISOString() },
      resumed_runs: [],
      automation_runs: [
        {
          ...runResponse,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
    });
  });

  it("maps service payload validation errors to the preserved 422 details envelope", async () => {
    mockServiceSendCustomEvent.mockRejectedValue(
      new TestCustomEventServiceError(
        "event_payload_invalid",
        "Event payload does not match schema",
        [
          {
            path: "payload.plan",
            message: 'Expected payload.plan to be "string"',
          },
        ],
      ),
    );
    const { POST } = await import("@/app/api/events/send/route");

    const response = await POST(
      jsonRequest("http://localhost/api/events/send", {
        event: "user.signed_up",
        email: "user@example.com",
        payload: { plan: 42 },
      }),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "Event payload does not match schema",
      code: "event_payload_invalid",
      details: [
        {
          path: "payload.plan",
          message: 'Expected payload.plan to be "string"',
        },
      ],
    });
  });
});
