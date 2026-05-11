import {
  type AutomationFormState,
  DEFAULT_FORM_STATE,
  buildConnections,
  buildSteps,
  fromAutomation,
  validateFormState,
} from "@/lib/automations/form";
import { describe, expect, it } from "vitest";

const validState: AutomationFormState = {
  ...DEFAULT_FORM_STATE,
  name: "Welcome sequence",
  status: "enabled",
  triggerEventName: "user.signed_up",
  delayEnabled: true,
  delayDuration: "3 days",
  templateId: "tmpl_published",
  fromOverride: "hello@example.com",
  subjectOverride: "Welcome!",
  replyToOverride: "support@example.com",
};

describe("automation MVP form helpers", () => {
  it("builds the linear trigger -> delay -> send_email -> end path", () => {
    expect(validateFormState(validState)).toEqual([]);

    expect(buildSteps(validState)).toEqual([
      {
        key: "trigger",
        type: "trigger",
        config: { event_name: "user.signed_up" },
        position: 0,
      },
      {
        key: "delay",
        type: "delay",
        config: { duration: "3 days" },
        position: 1,
      },
      {
        key: "send_email",
        type: "send_email",
        config: {
          template: { id: "tmpl_published" },
          from: "hello@example.com",
          subject: "Welcome!",
          reply_to: "support@example.com",
        },
        position: 2,
      },
      { key: "end", type: "end", config: {}, position: 3 },
    ]);
    expect(buildConnections(validState)).toEqual([
      { from: "trigger", to: "delay" },
      { from: "delay", to: "send_email" },
      { from: "send_email", to: "end" },
    ]);
  });

  it("omits delay and optional overrides when disabled or blank", () => {
    const state = {
      ...validState,
      delayEnabled: false,
      fromOverride: "",
      subjectOverride: "",
      replyToOverride: "",
    };

    expect(buildSteps(state).map((step) => step.type)).toEqual([
      "trigger",
      "send_email",
      "end",
    ]);
    expect(buildConnections(state)).toEqual([
      { from: "trigger", to: "send_email" },
      { from: "send_email", to: "end" },
    ]);
  });

  it("validates required fields, reserved events, and the 30-day delay cap", () => {
    const errors = validateFormState({
      ...validState,
      name: "",
      triggerEventName: "resend:delivered",
      delayDuration: "31 days",
      templateId: "",
    });

    expect(errors.map((error) => error.field)).toEqual([
      "name",
      "triggerEventName",
      "delayDuration",
      "templateId",
    ]);
  });

  it("hydrates edit state from an existing automation detail payload", () => {
    expect(
      fromAutomation({
        id: "auto_1",
        name: "Existing",
        status: "disabled",
        trigger_event_name: "fallback.event",
        steps: buildSteps(validState),
      }),
    ).toMatchObject({
      name: "Existing",
      status: "disabled",
      triggerEventName: "user.signed_up",
      delayEnabled: true,
      delayDuration: "3 days",
      templateId: "tmpl_published",
      subjectOverride: "Welcome!",
    });
  });

  it("builds a condition branch that skips email when not matched", () => {
    const state: AutomationFormState = {
      ...validState,
      delayEnabled: false,
      advancedStepEnabled: true,
      advancedStepType: "condition",
      conditionLeft: "event.plan",
      conditionOperator: "equals",
      conditionRight: "pro",
    };

    expect(validateFormState(state)).toEqual([]);
    expect(buildSteps(state)).toEqual([
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
          predicate: { left: "event.plan", operator: "equals", right: "pro" },
        },
        position: 1,
      },
      {
        key: "send_email",
        type: "send_email",
        config: {
          template: { id: "tmpl_published" },
          from: "hello@example.com",
          subject: "Welcome!",
          reply_to: "support@example.com",
        },
        position: 2,
      },
      { key: "end", type: "end", config: {}, position: 3 },
    ]);
    expect(buildConnections(state)).toEqual([
      { from: "trigger", to: "condition" },
      { from: "condition", to: "send_email", type: "condition_met" },
      { from: "condition", to: "end", type: "condition_not_met" },
      { from: "send_email", to: "end" },
    ]);
  });

  it("builds supported advanced step configs without changing backend shapes", () => {
    const waitState: AutomationFormState = {
      ...validState,
      advancedStepEnabled: true,
      advancedStepType: "wait_for_event",
      waitForEventName: "invoice.paid",
      waitForEventTimeoutSeconds: "86400",
    };
    expect(buildSteps(waitState)[2]).toMatchObject({
      key: "wait_for_event",
      type: "wait_for_event",
      config: { event_name: "invoice.paid", timeout_seconds: 86400 },
    });

    const updateState: AutomationFormState = {
      ...validState,
      advancedStepEnabled: true,
      advancedStepType: "contact_update",
      contactUpdateFirstName: "Ada",
      contactUpdateUnsubscribed: "false",
      contactUpdatePropertiesJson: '{"plan":"pro","score":42}',
    };
    expect(validateFormState(updateState)).toEqual([]);
    expect(buildSteps(updateState)[2]).toMatchObject({
      key: "contact_update",
      type: "contact_update",
      config: {
        fields: { first_name: "Ada", unsubscribed: false },
        properties: { plan: "pro", score: 42 },
      },
    });

    const segmentState: AutomationFormState = {
      ...validState,
      advancedStepEnabled: true,
      advancedStepType: "add_to_segment",
      addToSegmentId: "71111111-1111-1111-1111-111111111111",
    };
    expect(validateFormState(segmentState)).toEqual([]);
    expect(buildSteps(segmentState)[2]).toMatchObject({
      key: "add_to_segment",
      type: "add_to_segment",
      config: { segment_id: "71111111-1111-1111-1111-111111111111" },
    });
  });

  it("requires explicit confirmation and skips email for contact_delete", () => {
    const state: AutomationFormState = {
      ...validState,
      advancedStepEnabled: true,
      advancedStepType: "contact_delete",
      contactDeleteConfirmed: false,
    };

    expect(validateFormState(state)).toContainEqual({
      field: "contactDeleteConfirmed",
      message:
        "Confirm that this automation may permanently delete the matched contact.",
    });

    const confirmed = { ...state, contactDeleteConfirmed: true };
    expect(validateFormState(confirmed)).toEqual([]);
    expect(buildSteps(confirmed).map((step) => step.type)).toEqual([
      "trigger",
      "delay",
      "contact_delete",
      "end",
    ]);
    expect(buildConnections(confirmed)).toEqual([
      { from: "trigger", to: "delay" },
      { from: "delay", to: "contact_delete" },
      { from: "contact_delete", to: "end" },
    ]);
  });
});
