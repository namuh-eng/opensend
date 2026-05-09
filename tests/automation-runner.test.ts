import type {
  automationRuns,
  automationSteps,
  automations,
  contacts,
  customEventDeliveries,
  templates,
} from "@/lib/db/schema";
import {
  type AutomationRunnerDeps,
  processAutomationRunStep,
  resumeWaitingRunsForEvent,
} from "@/lib/workers/automation-runner";
import { describe, expect, it, vi } from "vitest";

type AutomationRun = typeof automationRuns.$inferSelect;
type Automation = typeof automations.$inferSelect;
type AutomationStep = typeof automationSteps.$inferSelect;
type Contact = typeof contacts.$inferSelect;
type Template = typeof templates.$inferSelect;
type Delivery = typeof customEventDeliveries.$inferSelect;

const now = new Date("2026-05-02T00:00:00.000Z");
const automation: Automation = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Welcome",
  status: "enabled",
  triggerEventName: "user.signed_up",
  connections: [
    { from: "trigger", to: "delay" },
    { from: "delay", to: "send" },
    { from: "send", to: "end" },
  ],
  createdAt: now,
  updatedAt: now,
  document: null,
  userId: "user_1",
};
const steps: AutomationStep[] = [
  {
    id: "21111111-1111-1111-1111-111111111111",
    automationId: automation.id,
    key: "trigger",
    type: "trigger",
    config: { event_name: "user.signed_up" },
    position: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "21111111-1111-1111-1111-111111111112",
    automationId: automation.id,
    key: "delay",
    type: "delay",
    config: { duration: "2 hours" },
    position: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "21111111-1111-1111-1111-111111111113",
    automationId: automation.id,
    key: "send",
    type: "send_email",
    config: {
      template: {
        id: "31111111-1111-1111-1111-111111111111",
        variables: { plan: "event.plan" },
      },
      subject: "Welcome {{contact.first_name}} to {{event.plan}}",
    },
    position: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "21111111-1111-1111-1111-111111111114",
    automationId: automation.id,
    key: "end",
    type: "end",
    config: {},
    position: 3,
    createdAt: now,
    updatedAt: now,
  },
];
const delivery: Delivery = {
  id: "41111111-1111-1111-1111-111111111111",
  eventName: "user.signed_up",
  contactId: "51111111-1111-1111-1111-111111111111",
  email: "user@example.com",
  payload: { plan: "pro" },
  receivedAt: now,
  userId: "user_1",
};
const contact: Contact = {
  id: "51111111-1111-1111-1111-111111111111",
  email: "user@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  unsubscribed: false,
  customProperties: {},
  segments: [],
  topicSubscriptions: [],
  createdAt: now,
  document: null,
  userId: "user_1",
};
const template: Template = {
  id: "31111111-1111-1111-1111-111111111111",
  name: "Welcome",
  alias: null,
  status: "published",
  subject: "Welcome {{first_name}}",
  from: "sender@example.com",
  replyTo: "reply@example.com",
  previewText: null,
  html: "<p>{{first_name}} picked {{plan}}</p>",
  text: "{{first_name}} picked {{plan}}",
  variables: [{ name: "plan", required: true }],
  currentVersionId: null,
  publishedAt: now,
  hasUnpublishedVersions: false,
  createdAt: now,
  document: null,
  userId: "user_1",
};

function run(overrides: Partial<AutomationRun> = {}): AutomationRun {
  return {
    id: "61111111-1111-1111-1111-111111111111",
    automationId: automation.id,
    triggerEventId: delivery.id,
    contactId: contact.id,
    status: "queued",
    currentStepKey: "trigger",
    stepStates: {},
    startedAt: null,
    completedAt: null,
    nextStepAt: now,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    userId: "user_1",
    ...overrides,
  };
}

function deps(overrides: Partial<AutomationRunnerDeps> = {}) {
  const updates: Array<Partial<AutomationRun>> = [];
  const sendEmail = vi.fn().mockResolvedValue({ id: "email_1" });
  const base: AutomationRunnerDeps = {
    now: () => now,
    getAutomation: vi.fn().mockResolvedValue(automation),
    listSteps: vi.fn().mockResolvedValue(steps),
    getDelivery: vi.fn().mockResolvedValue(delivery),
    getContact: vi.fn().mockResolvedValue(contact),
    getTemplate: vi.fn().mockResolvedValue(template),
    sendEmail,
    updateContact: vi.fn().mockResolvedValue(contact),
    deleteContact: vi.fn().mockResolvedValue({ id: contact.id }),
    listWaitingRunsByContact: vi.fn().mockResolvedValue([]),
    updateRun: vi.fn(async (_id, data) => {
      updates.push(data as Partial<AutomationRun>);
      return { ...run(), ...data } as AutomationRun;
    }),
    ...overrides,
  };
  return { deps: base, updates, sendEmail };
}

describe("automation runner", () => {
  it("advances trigger then schedules delay next_step_at without sleeping", async () => {
    const setup = deps();

    await processAutomationRunStep(run(), setup.deps);
    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "delay",
    });

    await processAutomationRunStep(
      run({
        currentStepKey: "delay",
        stepStates: setup.updates[0]?.stepStates,
      }),
      setup.deps,
    );

    expect(setup.updates[1]).toMatchObject({
      status: "waiting",
      currentStepKey: "delay",
      nextStepAt: new Date("2026-05-02T02:00:00.000Z"),
    });
    expect(setup.updates[1]?.stepStates?.delay).toMatchObject({
      status: "waiting",
      scheduledFor: "2026-05-02T02:00:00.000Z",
    });
  });

  it("resumes a due delayed run and calls the email publishing boundary", async () => {
    const setup = deps();

    await processAutomationRunStep(
      run({
        currentStepKey: "delay",
        status: "waiting",
        stepStates: {
          delay: { status: "waiting", scheduledFor: now.toISOString() },
        },
      }),
      setup.deps,
    );
    await processAutomationRunStep(
      run({
        currentStepKey: "send",
        stepStates: setup.updates[0]?.stepStates,
      }),
      setup.deps,
    );

    expect(setup.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "sender@example.com",
        to: ["user@example.com"],
        subject: "Welcome Ada to pro",
        html: "<p>Ada picked pro</p>",
        tags: [
          { name: "automation_id", value: automation.id },
          {
            name: "automation_run_id",
            value: "61111111-1111-1111-1111-111111111111",
          },
        ],
      }),
    );
    expect(setup.updates[1]).toMatchObject({
      status: "queued",
      currentStepKey: "end",
    });
    expect(setup.updates[1]?.stepStates?.send.output).toEqual({
      email_id: "email_1",
    });
  });

  it("evaluates condition steps and advances to the met branch in one tick", async () => {
    const conditionAutomation: Automation = {
      ...automation,
      connections: [
        { from: "trigger", to: "condition" },
        { from: "condition", to: "pro_end", type: "condition_met" },
        { from: "condition", to: "free_end", type: "condition_not_met" },
      ],
    };
    const conditionSteps: AutomationStep[] = [
      steps[0],
      {
        ...steps[1],
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
      { ...steps[3], key: "pro_end", position: 2 },
      { ...steps[3], key: "free_end", position: 3 },
    ];
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(conditionAutomation),
      listSteps: vi.fn().mockResolvedValue(conditionSteps),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "condition" }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "pro_end",
    });
    expect(setup.updates[0]?.stepStates?.condition).toMatchObject({
      status: "completed",
      output: { matched: true, branch: "condition_met" },
    });
  });

  it("enters wait_for_event waiting state without downstream work in the same tick", async () => {
    const waitAutomation: Automation = {
      ...automation,
      connections: [
        { from: "trigger", to: "wait" },
        { from: "wait", to: "send" },
      ],
    };
    const waitSteps: AutomationStep[] = [
      steps[0],
      {
        ...steps[1],
        key: "wait",
        type: "wait_for_event",
        config: { event_name: "invoice.paid", timeout_seconds: 900 },
        position: 1,
      },
      steps[2],
    ];
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(waitAutomation),
      listSteps: vi.fn().mockResolvedValue(waitSteps),
    });

    await processAutomationRunStep(run({ currentStepKey: "wait" }), setup.deps);

    expect(setup.sendEmail).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "waiting",
      currentStepKey: "wait",
      nextStepAt: new Date("2026-05-02T00:15:00.000Z"),
    });
    expect(setup.updates[0]?.stepStates?.wait).toMatchObject({
      status: "waiting",
      scheduledFor: "2026-05-02T00:15:00.000Z",
      output: {
        waiting_for_event: "invoice.paid",
        timeout_at: "2026-05-02T00:15:00.000Z",
      },
    });
  });

  it("fails a due wait_for_event timeout deterministically", async () => {
    const waitSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "wait",
        type: "wait_for_event",
        config: { event_name: "invoice.paid", timeout_seconds: 60 },
        position: 0,
      },
    ];
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue(waitSteps),
    });

    await processAutomationRunStep(
      run({
        currentStepKey: "wait",
        status: "waiting",
        nextStepAt: now,
        stepStates: {
          wait: {
            status: "waiting",
            scheduledFor: now.toISOString(),
            output: { waiting_for_event: "invoice.paid" },
          },
        },
      }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "wait",
      failureReason: "wait_for_event timed out waiting for invoice.paid",
    });
  });

  it("resumes a matching wait_for_event run and stores payload output", async () => {
    const waitAutomation: Automation = {
      ...automation,
      connections: [{ from: "wait", to: "send" }],
    };
    const waitSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "wait",
        type: "wait_for_event",
        config: { event_name: "invoice.paid", timeout_seconds: 3600 },
        position: 0,
      },
      steps[2],
    ];
    const waitingRun = run({
      currentStepKey: "wait",
      status: "waiting",
      stepStates: {
        wait: {
          status: "waiting",
          scheduledFor: "2026-05-02T01:00:00.000Z",
          output: { waiting_for_event: "invoice.paid" },
        },
      },
    });
    const invoiceDelivery: Delivery = {
      ...delivery,
      id: "41111111-1111-1111-1111-111111111112",
      eventName: "invoice.paid",
      payload: { invoice_id: "inv_1", plan: "pro" },
    };
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(waitAutomation),
      listSteps: vi.fn().mockResolvedValue(waitSteps),
      listWaitingRunsByContact: vi.fn().mockResolvedValue([waitingRun]),
    });

    const resumed = await resumeWaitingRunsForEvent(
      invoiceDelivery,
      setup.deps,
    );

    expect(resumed).toHaveLength(1);
    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "send",
      nextStepAt: now,
    });
    expect(setup.updates[0]?.stepStates?.wait).toMatchObject({
      status: "completed",
      output: {
        waiting_for_event: "invoice.paid",
        waited_event: {
          delivery_id: invoiceDelivery.id,
          event_name: "invoice.paid",
          payload: { invoice_id: "inv_1", plan: "pro" },
          contact_id: contact.id,
          email: "user@example.com",
          received_at: now.toISOString(),
          matched_at: now.toISOString(),
        },
      },
    });
  });

  it("does not resume wait_for_event runs for non-matching events", async () => {
    const waitSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "wait",
        type: "wait_for_event",
        config: { event_name: "invoice.paid" },
        position: 0,
      },
    ];
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue(waitSteps),
      listWaitingRunsByContact: vi.fn().mockResolvedValue([
        run({
          currentStepKey: "wait",
          status: "waiting",
          stepStates: {
            wait: {
              status: "waiting",
              output: { waiting_for_event: "invoice.paid" },
            },
          },
        }),
      ]),
    });

    const resumed = await resumeWaitingRunsForEvent(delivery, setup.deps);

    expect(resumed).toEqual([]);
    expect(setup.updates).toHaveLength(0);
  });

  it("resolves waited event output for downstream send_email variables", async () => {
    const waitSendStep: AutomationStep = {
      ...steps[2],
      config: {
        template: {
          id: "31111111-1111-1111-1111-111111111111",
          variables: { plan: "wait_events.wait.payload.plan" },
        },
        subject: "Invoice {{wait_events.wait.payload.invoice_id}} paid",
      },
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([waitSendStep]),
    });

    await processAutomationRunStep(
      run({
        currentStepKey: "send",
        stepStates: {
          wait: {
            status: "completed",
            output: {
              waited_event: {
                payload: { invoice_id: "inv_1", plan: "enterprise" },
              },
            },
          },
        },
      }),
      setup.deps,
    );

    expect(setup.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Invoice inv_1 paid",
        html: "<p>Ada picked enterprise</p>",
      }),
    );
  });

  it("evaluates condition steps and advances to the not-met branch", async () => {
    const conditionAutomation: Automation = {
      ...automation,
      connections: [
        { from: "condition", to: "pro_end", type: "condition_met" },
        { from: "condition", to: "free_end", type: "condition_not_met" },
      ],
    };
    const conditionSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "condition",
        type: "condition",
        config: {
          predicate: {
            left: "event.plan",
            operator: "equals",
            right: "enterprise",
          },
        },
        position: 0,
      },
      { ...steps[3], key: "pro_end", position: 1 },
      { ...steps[3], key: "free_end", position: 2 },
    ];
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(conditionAutomation),
      listSteps: vi.fn().mockResolvedValue(conditionSteps),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "condition" }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "free_end",
    });
    expect(setup.updates[0]?.stepStates?.condition.output).toEqual({
      matched: false,
      branch: "condition_not_met",
    });
  });

  it("can compare prior step output values in condition predicates", async () => {
    const conditionAutomation: Automation = {
      ...automation,
      connections: [
        { from: "condition", to: "matched", type: "condition_met" },
        { from: "condition", to: "not_matched", type: "condition_not_met" },
      ],
    };
    const conditionSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "condition",
        type: "condition",
        config: {
          predicate: {
            left: "steps.send.output.email_id",
            operator: "equals",
            right: "email_1",
          },
        },
        position: 0,
      },
      { ...steps[3], key: "matched", position: 1 },
      { ...steps[3], key: "not_matched", position: 2 },
    ];
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(conditionAutomation),
      listSteps: vi.fn().mockResolvedValue(conditionSteps),
    });

    await processAutomationRunStep(
      run({
        currentStepKey: "condition",
        stepStates: {
          send: {
            status: "completed",
            output: { email_id: "email_1" },
          },
        },
      }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "matched",
    });
  });

  it("fails condition steps with missing variables at the step level", async () => {
    const conditionSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "condition",
        type: "condition",
        config: {
          predicate: {
            left: "event.missing",
            operator: "equals",
            right: "pro",
          },
        },
        position: 0,
      },
    ];
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue(conditionSteps),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "condition" }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "condition",
      failureReason: "condition variable not found: event.missing",
    });
    expect(setup.updates[0]?.stepStates?.condition).toMatchObject({
      status: "failed",
      error: "condition variable not found: event.missing",
    });
  });

  it("fails condition steps with invalid persisted predicate configs", async () => {
    const conditionSteps: AutomationStep[] = [
      {
        ...steps[1],
        key: "condition",
        type: "condition",
        config: { predicate: { left: "event.plan", operator: "between" } },
        position: 0,
      },
    ];
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue(conditionSteps),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "condition" }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "condition",
      failureReason: "condition predicate operator is unsupported",
    });
  });

  it("updates the current contact with resolved fields and minimal output", async () => {
    const updateAutomation: Automation = {
      ...automation,
      connections: [{ from: "update", to: "end" }],
    };
    const updateStep: AutomationStep = {
      ...steps[1],
      key: "update",
      type: "contact_update",
      config: {
        fields: {
          email: "event.new_email",
          first_name: "wait_events.wait.payload.first_name",
          unsubscribed: true,
        },
        properties: {
          plan: "event.plan",
          invoice: "wait_events.wait.payload.invoice_id",
        },
      },
      position: 0,
    };
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(updateAutomation),
      listSteps: vi.fn().mockResolvedValue([updateStep, steps[3]]),
      getDelivery: vi.fn().mockResolvedValue({
        ...delivery,
        payload: { plan: "pro", new_email: "NEW@example.com" },
      }),
    });

    await processAutomationRunStep(
      run({
        currentStepKey: "update",
        stepStates: {
          wait: {
            status: "completed",
            output: {
              waited_event: {
                payload: { first_name: "Grace", invoice_id: "inv_1" },
              },
            },
          },
        },
      }),
      setup.deps,
    );

    expect(setup.deps.updateContact).toHaveBeenCalledWith(contact.id, {
      email: "new@example.com",
      firstName: "Grace",
      unsubscribed: true,
      customProperties: { plan: "pro", invoice: "inv_1" },
    });
    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "end",
    });
    expect(setup.updates[0]?.stepStates?.update.output).toEqual({
      contact_id: contact.id,
      changed_fields: [
        "email",
        "first_name",
        "unsubscribed",
        "properties.plan",
        "properties.invoice",
      ],
    });
  });

  it("fails contact_update without a current contact", async () => {
    const updateStep: AutomationStep = {
      ...steps[1],
      key: "update",
      type: "contact_update",
      config: { fields: { first_name: "event.first_name" } },
      position: 0,
    };
    const setup = deps({ listSteps: vi.fn().mockResolvedValue([updateStep]) });

    await processAutomationRunStep(
      run({ currentStepKey: "update", contactId: null }),
      setup.deps,
    );

    expect(setup.deps.updateContact).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "update",
      failureReason: "contact_update requires a contact",
    });
  });

  it("fails contact_update when email resolves invalid", async () => {
    const updateStep: AutomationStep = {
      ...steps[1],
      key: "update",
      type: "contact_update",
      config: { fields: { email: "event.bad_email" } },
      position: 0,
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([updateStep]),
      getDelivery: vi.fn().mockResolvedValue({
        ...delivery,
        payload: { bad_email: "not-an-email" },
      }),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "update" }),
      setup.deps,
    );

    expect(setup.deps.updateContact).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      failureReason:
        "contact_update email must resolve to a valid email string",
    });
  });

  it("fails contact_update email unique conflicts deterministically", async () => {
    const updateStep: AutomationStep = {
      ...steps[1],
      key: "update",
      type: "contact_update",
      config: { fields: { email: "taken@example.com" } },
      position: 0,
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([updateStep]),
      updateContact: vi.fn().mockRejectedValue({ code: "23505" }),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "update" }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "update",
      failureReason: "contact_update email already exists",
    });
  });

  it("fails missing or unpublished templates with a step-level error", async () => {
    const setup = deps({
      getTemplate: vi.fn().mockResolvedValue({ ...template, status: "draft" }),
    });

    await processAutomationRunStep(run({ currentStepKey: "send" }), setup.deps);

    expect(setup.sendEmail).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "send",
      failureReason: "send_email template is missing or unpublished",
    });
    expect(setup.updates[0]?.stepStates?.send).toMatchObject({
      status: "failed",
      error: "send_email template is missing or unpublished",
    });
  });

  it("deletes the current contact and terminates the run with minimal output", async () => {
    const deleteAutomation: Automation = {
      ...automation,
      connections: [
        { from: "trigger", to: "delete" },
        { from: "delete", to: "send" },
      ],
    };
    const deleteStep: AutomationStep = {
      ...steps[1],
      key: "delete",
      type: "contact_delete",
      config: {},
      position: 1,
    };
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(deleteAutomation),
      listSteps: vi.fn().mockResolvedValue([steps[0], deleteStep, steps[2]]),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "delete" }),
      setup.deps,
    );

    expect(setup.deps.deleteContact).toHaveBeenCalledWith(contact.id);
    expect(setup.sendEmail).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "completed",
      currentStepKey: null,
      contactId: null,
    });
    expect(setup.updates[0]?.stepStates?.delete).toMatchObject({
      status: "completed",
      output: { deleted_contact_id: contact.id },
    });
  });

  it("does not run downstream contact-dependent steps after a successful delete", async () => {
    const deleteAutomation: Automation = {
      ...automation,
      connections: [
        { from: "delete", to: "send" },
        { from: "send", to: "end" },
      ],
    };
    const deleteStep: AutomationStep = {
      ...steps[1],
      key: "delete",
      type: "contact_delete",
      config: {},
      position: 0,
    };
    const setup = deps({
      getAutomation: vi.fn().mockResolvedValue(deleteAutomation),
      listSteps: vi.fn().mockResolvedValue([deleteStep, steps[2], steps[3]]),
    });

    const completed = await processAutomationRunStep(
      run({ currentStepKey: "delete" }),
      setup.deps,
    );

    // Run is terminal — no further dispatch happens. Simulate the scheduler
    // re-loading this run and confirm the runner does not attempt downstream work.
    expect(completed?.status).toBe("completed");
    expect(completed?.currentStepKey).toBeNull();
    expect(setup.sendEmail).not.toHaveBeenCalled();
    expect(setup.deps.updateContact).not.toHaveBeenCalled();
  });

  it("fails contact_delete deterministically when the contact is missing", async () => {
    const deleteStep: AutomationStep = {
      ...steps[1],
      key: "delete",
      type: "contact_delete",
      config: {},
      position: 0,
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([deleteStep]),
      getContact: vi.fn().mockResolvedValue(null),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "delete" }),
      setup.deps,
    );

    expect(setup.deps.deleteContact).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "delete",
      failureReason: "contact_delete contact not found",
    });
    expect(setup.updates[0]?.stepStates?.delete).toMatchObject({
      status: "failed",
      error: "contact_delete contact not found",
    });
  });

  it("fails contact_delete when delete returns no rows (idempotent storage race)", async () => {
    const deleteStep: AutomationStep = {
      ...steps[1],
      key: "delete",
      type: "contact_delete",
      config: {},
      position: 0,
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([deleteStep]),
      deleteContact: vi.fn().mockResolvedValue(null),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "delete" }),
      setup.deps,
    );

    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "delete",
      failureReason: "contact_delete contact not found",
    });
  });

  it("skips repeated contact_delete steps when the run already lost its contact", async () => {
    const deleteStep: AutomationStep = {
      ...steps[1],
      key: "delete_again",
      type: "contact_delete",
      config: {},
      position: 0,
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([deleteStep]),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "delete_again", contactId: null }),
      setup.deps,
    );

    expect(setup.deps.getContact).not.toHaveBeenCalled();
    expect(setup.deps.deleteContact).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "completed",
      currentStepKey: null,
    });
    expect(setup.updates[0]?.stepStates?.delete_again).toMatchObject({
      status: "skipped",
      output: { reason: "contact_already_deleted" },
    });
  });

  it("fails contact_delete steps with non-empty config persisted on disk", async () => {
    const deleteStep: AutomationStep = {
      ...steps[1],
      key: "delete",
      type: "contact_delete",
      config: { foo: "bar" },
      position: 0,
    };
    const setup = deps({
      listSteps: vi.fn().mockResolvedValue([deleteStep]),
    });

    await processAutomationRunStep(
      run({ currentStepKey: "delete" }),
      setup.deps,
    );

    expect(setup.deps.deleteContact).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "failed",
      currentStepKey: "delete",
      failureReason: "contact_delete config must be empty",
    });
  });

  it("skips send_email for unsubscribed contacts", async () => {
    const setup = deps({
      getContact: vi.fn().mockResolvedValue({ ...contact, unsubscribed: true }),
    });

    await processAutomationRunStep(run({ currentStepKey: "send" }), setup.deps);

    expect(setup.sendEmail).not.toHaveBeenCalled();
    expect(setup.updates[0]).toMatchObject({
      status: "queued",
      currentStepKey: "end",
    });
    expect(setup.updates[0]?.stepStates?.send).toMatchObject({
      status: "skipped",
      output: { reason: "contact_unsubscribed", contact_id: contact.id },
    });
  });
});
