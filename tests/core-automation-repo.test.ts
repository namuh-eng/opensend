import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();
const mockAutomationsInsertReturning = vi.fn();
const mockStepsInsertReturning = vi.fn();
const mockFindAutomationFirst = vi.fn();
const mockRunInsertReturning = vi.fn();

vi.mock("../packages/core/src/db/client", () => ({
  db: {
    query: {
      automations: {
        findFirst: mockFindAutomationFirst,
      },
    },
    transaction: mockTransaction,
    insert: vi.fn(() => ({
      values: () => ({
        returning: mockRunInsertReturning,
      }),
    })),
  },
}));

describe("automationRepo.create", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockAutomationsInsertReturning.mockResolvedValue([
      {
        id: "auto_1",
        name: "Welcome",
        status: "draft",
        triggerEventName: "user.signed_up",
      },
    ]);
    mockStepsInsertReturning.mockResolvedValue([
      { id: "step_t", key: "trigger", type: "trigger", position: 0 },
      { id: "step_d", key: "delay", type: "delay", position: 1 },
      { id: "step_s", key: "send", type: "send_email", position: 2 },
      { id: "step_e", key: "end", type: "end", position: 3 },
    ]);

    let insertCallCount = 0;
    mockTransaction.mockImplementation(async (callback) => {
      const tx = {
        insert: () => {
          insertCallCount += 1;
          return {
            values: () => ({
              returning:
                insertCallCount === 1
                  ? mockAutomationsInsertReturning
                  : mockStepsInsertReturning,
            }),
          };
        },
      };
      return await callback(tx);
    });
  });

  it("persists the MVP trigger -> delay -> send_email -> end path", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    const result = await automationRepo.create({
      name: "Welcome",
      steps: [
        {
          key: "trigger",
          type: "trigger",
          config: { event_name: "user.signed_up" },
          position: 0,
        },
        {
          key: "delay",
          type: "delay",
          config: { duration: "1 day" },
          position: 1,
        },
        {
          key: "send",
          type: "send_email",
          config: { template: { id: "tmpl_1" }, subject: "Hi" },
          position: 2,
        },
        { key: "end", type: "end", config: {}, position: 3 },
      ],
      connections: [
        { from: "trigger", to: "delay" },
        { from: "delay", to: "send" },
        { from: "send", to: "end" },
      ],
    });

    expect(result.automation.id).toBe("auto_1");
    expect(result.steps).toHaveLength(4);
  });

  it("rejects automations whose first step is not a trigger", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "delay",
            type: "delay",
            config: { duration: "1d" },
            position: 0,
          },
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 1,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "trigger_must_be_first" });
  });

  it("rejects duplicate step keys", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "step",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          { key: "step", type: "end", config: {}, position: 1 },
        ],
      }),
    ).rejects.toMatchObject({ code: "duplicate_step_key" });
  });

  it("rejects connections that point at unknown step keys", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          { key: "end", type: "end", config: {}, position: 1 },
        ],
        connections: [{ from: "trigger", to: "missing" }],
      }),
    ).rejects.toMatchObject({ code: "connection_unknown_step" });
  });

  it("accepts condition steps with explicit met and not-met branches", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
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
            position: 1,
          },
          { key: "met", type: "end", config: {}, position: 2 },
          { key: "not_met", type: "end", config: {}, position: 3 },
        ],
        connections: [
          { from: "trigger", to: "condition" },
          { from: "condition", to: "met", type: "condition_met" },
          { from: "condition", to: "not_met", type: "condition_not_met" },
        ],
      }),
    ).resolves.toMatchObject({ automation: { id: "auto_1" } });
  });

  it("rejects unsupported condition predicate configs", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          {
            key: "condition",
            type: "condition",
            config: {
              predicate: { left: "event.plan", operator: "between" },
            },
            position: 1,
          },
          { key: "end", type: "end", config: {}, position: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "condition_operator_invalid" });
  });

  it("accepts wait_for_event steps with bounded timeout config", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          {
            key: "wait",
            type: "wait_for_event",
            config: { event_name: "invoice.paid", timeout_seconds: 3600 },
            position: 1,
          },
          { key: "end", type: "end", config: {}, position: 2 },
        ],
        connections: [
          { from: "trigger", to: "wait" },
          { from: "wait", to: "end" },
        ],
      }),
    ).resolves.toMatchObject({ automation: { id: "auto_1" } });
  });

  it("rejects invalid wait_for_event timeout config", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          {
            key: "wait",
            type: "wait_for_event",
            config: { event_name: "invoice.paid", timeout_seconds: 0 },
            position: 1,
          },
          { key: "end", type: "end", config: {}, position: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "wait_for_event_timeout_invalid" });
  });

  it("accepts contact_update steps with explicit safe field and property mappings", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.updated" },
          },
          {
            key: "update",
            type: "contact_update",
            config: {
              fields: {
                email: "event.email",
                first_name: "contact.first_name",
                last_name: "steps.enrich.output.last_name",
                unsubscribed: false,
              },
              properties: { plan: "wait_events.wait.payload.plan" },
            },
          },
        ],
        connections: [{ from: "trigger", to: "update" }],
      }),
    ).resolves.toMatchObject({ automation: { id: "auto_1" } });
  });

  it("rejects contact_update configs with dangerous generic property fields", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.updated" },
          },
          {
            key: "update",
            type: "contact_update",
            config: {
              properties: { unsubscribed: "event.unsubscribed" },
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "contact_update_property_reserved" });
  });

  it("rejects contact_update configs with unsupported top-level or field keys", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.updated" },
          },
          {
            key: "update",
            type: "contact_update",
            config: { fields: { segments: ["vip"] } },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "contact_update_field_invalid" });
  });

  it("rejects condition branch labels from non-condition steps", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          { key: "end", type: "end", config: {}, position: 1 },
        ],
        connections: [{ from: "trigger", to: "end", type: "condition_met" }],
      }),
    ).rejects.toMatchObject({ code: "connection_branch_from_non_condition" });
  });

  it("rejects duplicate branch labels from the same step", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
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
            position: 1,
          },
          { key: "met", type: "end", config: {}, position: 2 },
          { key: "also_met", type: "end", config: {}, position: 3 },
        ],
        connections: [
          { from: "condition", to: "met", type: "condition_met" },
          { from: "condition", to: "also_met", type: "condition_met" },
        ],
      }),
    ).rejects.toMatchObject({ code: "connection_branch_duplicate" });
  });

  it("rejects trigger event names that use the reserved resend: prefix", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "resend:bounced" },
            position: 0,
          },
          { key: "end", type: "end", config: {}, position: 1 },
        ],
      }),
    ).rejects.toMatchObject({ code: "event_name_reserved" });
  });

  it("rejects delay durations that exceed 30 days", async () => {
    const { automationRepo } = await import(
      "../packages/core/src/db/repositories/automationRepo"
    );

    await expect(
      automationRepo.create({
        steps: [
          {
            key: "trigger",
            type: "trigger",
            config: { event_name: "user.signed_up" },
            position: 0,
          },
          {
            key: "delay",
            type: "delay",
            config: { duration: "60 days" },
            position: 1,
          },
          { key: "end", type: "end", config: {}, position: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "delay_duration_too_long" });
  });
});

describe("automationRunRepo.createFromTrigger", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates a queued run referencing the triggering event and contact", async () => {
    mockFindAutomationFirst.mockResolvedValue({
      id: "auto_1",
      status: "enabled",
      userId: "user_1",
    });
    mockRunInsertReturning.mockResolvedValue([
      {
        id: "run_1",
        automationId: "auto_1",
        triggerEventId: "evt_1",
        contactId: "contact_1",
        status: "queued",
      },
    ]);

    const { automationRunRepo } = await import(
      "../packages/core/src/db/repositories/automationRunRepo"
    );

    const run = await automationRunRepo.createFromTrigger({
      automationId: "auto_1",
      triggerEventId: "evt_1",
      contactId: "contact_1",
    });

    expect(run).toMatchObject({
      id: "run_1",
      automationId: "auto_1",
      contactId: "contact_1",
      triggerEventId: "evt_1",
      status: "queued",
    });
  });

  it("refuses to create a run for an automation that is not enabled", async () => {
    mockFindAutomationFirst.mockResolvedValue({
      id: "auto_1",
      status: "draft",
    });

    const { automationRunRepo } = await import(
      "../packages/core/src/db/repositories/automationRunRepo"
    );

    await expect(
      automationRunRepo.createFromTrigger({ automationId: "auto_1" }),
    ).rejects.toMatchObject({ code: "automation_not_enabled" });
  });
});
