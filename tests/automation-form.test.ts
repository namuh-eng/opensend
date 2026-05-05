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
});
