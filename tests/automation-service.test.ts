import {
  AutomationServiceError,
  type AutomationServiceRepository,
  createAutomationService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type AutomationRow = NonNullable<
  Awaited<ReturnType<AutomationServiceRepository["findByIdForUser"]>>
>;
type AutomationStepRow = Awaited<
  ReturnType<AutomationServiceRepository["listSteps"]>
>[number];
type CreateInput = Parameters<AutomationServiceRepository["create"]>[0];
type ListInput = Parameters<AutomationServiceRepository["list"]>[0];
type UpdateData = Parameters<AutomationServiceRepository["update"]>[1];
type ReplaceStepsInput = Parameters<
  AutomationServiceRepository["replaceStepsAndUpdate"]
>[0];

const now = new Date("2026-05-02T00:00:00.000Z");

function makeAutomation(overrides: Partial<AutomationRow> = {}): AutomationRow {
  return {
    id: "auto_1",
    name: "Welcome",
    status: "enabled",
    triggerEventName: "user.signed_up",
    connections: [],
    createdAt: now,
    updatedAt: now,
    document: null,
    userId: "user_1",
    ...overrides,
  };
}

function makeStep(
  overrides: Partial<AutomationStepRow> = {},
): AutomationStepRow {
  return {
    id: "step_1",
    automationId: "auto_1",
    key: "trigger",
    type: "trigger",
    config: { event_name: "user.signed_up" },
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<AutomationServiceRepository> = {},
): AutomationServiceRepository {
  const repository: AutomationServiceRepository = {
    async create(input) {
      return {
        automation: makeAutomation({
          name: input.name ?? "Untitled",
          status: input.status ?? "draft",
          triggerEventName: input.triggerEventName ?? "user.signed_up",
          connections: input.connections ?? [],
          userId: input.userId ?? null,
        }),
        steps: input.steps.map((step, index) =>
          makeStep({
            id: `step_${index}`,
            key: step.key,
            type: step.type,
            config: step.config,
            position: step.position ?? index,
          }),
        ),
      };
    },
    async list() {
      return { data: [makeAutomation()], hasMore: false };
    },
    async findByIdForUser(id, userId) {
      if (id !== "auto_1") return undefined;
      if (userId && userId !== "user_1") return undefined;
      return makeAutomation();
    },
    async listSteps() {
      return [makeStep()];
    },
    validate(input) {
      return {
        triggerEventName: input.triggerEventName ?? "user.signed_up",
        steps: input.steps.map((step, index) => ({
          ...step,
          config: step.config ?? {},
          position: step.position ?? index,
        })),
        connections: input.connections ?? [],
      };
    },
    async update() {
      return [makeAutomation({ name: "Updated" })];
    },
    async replaceStepsAndUpdate() {},
    async delete(id) {
      return [{ id }];
    },
    async countStepsByAutomationIds(automationIds) {
      return new Map(automationIds.map((id) => [id, 2]));
    },
    async findLastRunsByAutomationIds(automationIds) {
      return new Map(
        automationIds.map((id) => [
          id,
          { status: "completed", created_at: now },
        ]),
      );
    },
  };

  return { ...repository, ...overrides };
}

describe("automation CRUD service boundary", () => {
  it("creates automations with caller scope and public response formatting", async () => {
    let capturedInput: CreateInput | undefined;
    const service = createAutomationService({
      repository: makeRepository({
        async create(input) {
          capturedInput = input;
          return {
            automation: makeAutomation({
              name: input.name,
              status: input.status,
              triggerEventName: input.triggerEventName,
              userId: input.userId,
            }),
            steps: [
              makeStep({ key: "trigger", config: input.steps[0].config }),
            ],
          };
        },
      }),
    });

    const result = await service.createAutomation({
      userId: "user_1",
      data: {
        name: "Welcome",
        status: "enabled",
        trigger_event_name: "user.signed_up",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { eventName: "user.signed_up" },
          },
        ],
      },
    });

    expect(capturedInput).toMatchObject({
      name: "Welcome",
      status: "enabled",
      triggerEventName: "user.signed_up",
      userId: "user_1",
      steps: [{ key: "trigger", config: { eventName: "user.signed_up" } }],
    });
    expect(result).toMatchObject({
      object: "automation",
      id: "auto_1",
      trigger_event_name: "user.signed_up",
      steps: [{ key: "trigger" }],
    });
  });

  it("lists automations with filters, step counts, last run enrichment, and list envelope", async () => {
    let capturedListInput: ListInput | undefined;
    const service = createAutomationService({
      repository: makeRepository({
        async list(input) {
          capturedListInput = input;
          return {
            data: [
              makeAutomation({ id: "auto_1" }),
              makeAutomation({ id: "auto_2" }),
            ],
            hasMore: true,
          };
        },
        async countStepsByAutomationIds() {
          return new Map([["auto_1", 3]]);
        },
        async findLastRunsByAutomationIds() {
          return new Map([["auto_2", { status: "failed", created_at: now }]]);
        },
      }),
    });

    const result = await service.listAutomations({
      userId: "user_1",
      status: "enabled",
      search: "Welcome",
      limit: 10,
      after: "auto_9",
    });

    expect(capturedListInput).toEqual({
      userId: "user_1",
      status: "enabled",
      search: "Welcome",
      limit: 10,
      after: "auto_9",
    });
    expect(result).toMatchObject({
      object: "list",
      has_more: true,
      data: [
        { id: "auto_1", step_count: 3, last_run: null },
        {
          id: "auto_2",
          step_count: 0,
          last_run: { status: "failed", created_at: now },
        },
      ],
    });
  });

  it("retrieves detail through user-scoped lookup and ordered step formatting", async () => {
    const service = createAutomationService({
      repository: makeRepository({
        async listSteps() {
          return [
            makeStep({
              id: "step_2",
              key: "send",
              type: "send_email",
              position: 2,
            }),
            makeStep({ id: "step_1", key: "trigger", position: 0 }),
          ];
        },
      }),
    });

    await expect(
      service.getAutomation("user_1", "auto_1"),
    ).resolves.toMatchObject({
      id: "auto_1",
      steps: [{ key: "trigger" }, { key: "send" }],
    });
    await expect(
      service.getAutomation("user_2", "auto_1"),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Automation not found",
    });
  });

  it("replaces steps and updates automation metadata when patching steps", async () => {
    let capturedReplace: ReplaceStepsInput | undefined;
    const service = createAutomationService({
      repository: makeRepository({
        async replaceStepsAndUpdate(input) {
          capturedReplace = input;
        },
      }),
    });

    await service.updateAutomation({
      userId: "user_1",
      id: "auto_1",
      data: {
        name: "Updated",
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "invoice.paid" },
          },
          { key: "end", type: "end" },
        ],
        connections: [{ from: "trigger", to: "end" }],
      },
    });

    expect(capturedReplace).toMatchObject({
      automationId: "auto_1",
      steps: [
        { key: "trigger", position: 0 },
        { key: "end", config: {}, position: 1 },
      ],
      update: {
        name: "Updated",
        status: "enabled",
        triggerEventName: "user.signed_up",
        connections: [{ from: "trigger", to: "end" }],
      },
    });
  });

  it("validates connection-only updates against existing steps before scoped update", async () => {
    let capturedUpdate: UpdateData | undefined;
    const service = createAutomationService({
      repository: makeRepository({
        async update(_id, data) {
          capturedUpdate = data;
          return [makeAutomation(data)];
        },
      }),
    });

    await service.updateAutomation({
      userId: "user_1",
      id: "auto_1",
      data: { connections: [{ from: "trigger", to: "trigger" }] },
    });

    expect(capturedUpdate).toMatchObject({
      triggerEventName: "user.signed_up",
      connections: [{ from: "trigger", to: "trigger" }],
    });
  });

  it("stops automations by idempotently disabling the tenant-scoped record", async () => {
    const updates: UpdateData[] = [];
    let stored = makeAutomation({ status: "enabled" });
    const service = createAutomationService({
      repository: makeRepository({
        async findByIdForUser(id, userId) {
          if (id !== "auto_1") return undefined;
          if (userId && userId !== "user_1") return undefined;
          return stored;
        },
        async update(_id, data) {
          updates.push(data);
          stored = makeAutomation({ ...stored, ...data });
          return [stored];
        },
      }),
    });

    await expect(
      service.stopAutomation("user_1", "auto_1"),
    ).resolves.toMatchObject({
      id: "auto_1",
      status: "disabled",
    });
    await expect(
      service.stopAutomation("user_1", "auto_1"),
    ).resolves.toMatchObject({
      id: "auto_1",
      status: "disabled",
    });
    await expect(
      service.stopAutomation("user_2", "auto_1"),
    ).rejects.toMatchObject({
      code: "not_found",
    });
    expect(updates).toEqual([{ status: "disabled" }]);
  });

  it("rejects enabled deletes and preserves the delete response shape for disabled automations", async () => {
    const enabledService = createAutomationService({
      repository: makeRepository(),
    });
    await expect(
      enabledService.deleteAutomation("user_1", "auto_1"),
    ).rejects.toBeInstanceOf(AutomationServiceError);
    await expect(
      enabledService.deleteAutomation("user_1", "auto_1"),
    ).rejects.toMatchObject({
      code: "delete_forbidden",
      message: "Disable the automation before deleting",
    });

    const disabledService = createAutomationService({
      repository: makeRepository({
        async findByIdForUser() {
          return makeAutomation({ status: "disabled" });
        },
      }),
    });

    await expect(
      disabledService.deleteAutomation("user_1", "auto_1"),
    ).resolves.toEqual({
      object: "automation",
      id: "auto_1",
      deleted: true,
    });
  });
});
