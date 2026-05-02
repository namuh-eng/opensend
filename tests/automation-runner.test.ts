import type {
  automationRuns,
  automationSteps,
  automations,
  contacts,
  customEventDeliveries,
  templates,
} from "@/lib/db/schema";
import type { AutomationRunnerDeps } from "@/lib/workers/automation-runner";
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
    const { processAutomationRunStep } = await import(
      "@/lib/workers/automation-runner"
    );
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
    const { processAutomationRunStep } = await import(
      "@/lib/workers/automation-runner"
    );
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

  it("fails missing or unpublished templates with a step-level error", async () => {
    const { processAutomationRunStep } = await import(
      "@/lib/workers/automation-runner"
    );
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

  it("skips send_email for unsubscribed contacts", async () => {
    const { processAutomationRunStep } = await import(
      "@/lib/workers/automation-runner"
    );
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
