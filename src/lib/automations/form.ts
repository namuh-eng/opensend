export type AutomationStatus = "draft" | "enabled" | "disabled";

export interface AutomationFormStep {
  key: string;
  type: "trigger" | "delay" | "send_email" | "end";
  config: Record<string, unknown>;
  position: number;
}

export interface AutomationFormState {
  name: string;
  status: AutomationStatus;
  triggerEventName: string;
  delayEnabled: boolean;
  delayDuration: string;
  templateId: string;
  fromOverride: string;
  subjectOverride: string;
  replyToOverride: string;
}

export const DEFAULT_FORM_STATE: AutomationFormState = {
  name: "Untitled automation",
  status: "draft",
  triggerEventName: "",
  delayEnabled: false,
  delayDuration: "1 hour",
  templateId: "",
  fromOverride: "",
  subjectOverride: "",
  replyToOverride: "",
};

export function buildSteps(state: AutomationFormState): AutomationFormStep[] {
  const steps: AutomationFormStep[] = [];
  let position = 0;

  steps.push({
    key: "trigger",
    type: "trigger",
    config: { event_name: state.triggerEventName },
    position: position++,
  });

  if (state.delayEnabled) {
    steps.push({
      key: "delay",
      type: "delay",
      config: { duration: state.delayDuration },
      position: position++,
    });
  }

  const sendConfig: Record<string, unknown> = {
    template: { id: state.templateId },
  };
  if (state.fromOverride.trim()) sendConfig.from = state.fromOverride.trim();
  if (state.subjectOverride.trim())
    sendConfig.subject = state.subjectOverride.trim();
  if (state.replyToOverride.trim())
    sendConfig.reply_to = state.replyToOverride.trim();

  steps.push({
    key: "send_email",
    type: "send_email",
    config: sendConfig,
    position: position++,
  });

  steps.push({
    key: "end",
    type: "end",
    config: {},
    position: position++,
  });

  return steps;
}

export function buildConnections(state: AutomationFormState): Array<{
  from: string;
  to: string;
}> {
  const order: string[] = ["trigger"];
  if (state.delayEnabled) order.push("delay");
  order.push("send_email", "end");
  const connections: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < order.length - 1; i += 1) {
    connections.push({ from: order[i], to: order[i + 1] });
  }
  return connections;
}

export interface AutomationFormValidationError {
  field: keyof AutomationFormState;
  message: string;
}

const RESERVED_PREFIX = "resend:";
const DURATION_PATTERN =
  /^\s*(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\s*$/i;
const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: 60,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  d: 86400,
  day: 86400,
  days: 86400,
  w: 604800,
  week: 604800,
  weeks: 604800,
};
const MAX_DELAY_SECONDS = 30 * 24 * 60 * 60;

export function validateFormState(
  state: AutomationFormState,
): AutomationFormValidationError[] {
  const errors: AutomationFormValidationError[] = [];

  if (!state.name.trim()) {
    errors.push({ field: "name", message: "Name is required." });
  }

  const trigger = state.triggerEventName.trim();
  if (!trigger) {
    errors.push({
      field: "triggerEventName",
      message: "Trigger event name is required.",
    });
  } else if (trigger.toLowerCase().startsWith(RESERVED_PREFIX)) {
    errors.push({
      field: "triggerEventName",
      message: `Event names beginning with "${RESERVED_PREFIX}" are reserved.`,
    });
  }

  if (state.delayEnabled) {
    const match = DURATION_PATTERN.exec(state.delayDuration);
    if (!match) {
      errors.push({
        field: "delayDuration",
        message:
          'Delay must be a natural-language duration like "1 hour" or "3 days".',
      });
    } else {
      const amount = Number.parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      const factor = UNIT_TO_SECONDS[unit];
      if (!Number.isFinite(amount) || amount <= 0 || !factor) {
        errors.push({
          field: "delayDuration",
          message: "Delay must be a positive duration.",
        });
      } else {
        const seconds = Math.round(amount * factor);
        if (seconds > MAX_DELAY_SECONDS) {
          errors.push({
            field: "delayDuration",
            message: "Delay must be 30 days or less.",
          });
        }
      }
    }
  }

  if (!state.templateId) {
    errors.push({
      field: "templateId",
      message: "Pick a published template to send.",
    });
  }

  return errors;
}

export interface ApiAutomationStep {
  key: string;
  type: string;
  config: Record<string, unknown>;
  position: number;
}

export interface ApiAutomation {
  id: string;
  name: string;
  status: AutomationStatus | string;
  trigger_event_name: string | null;
  steps?: ApiAutomationStep[];
}

export function fromAutomation(automation: ApiAutomation): AutomationFormState {
  const state: AutomationFormState = {
    ...DEFAULT_FORM_STATE,
    name: automation.name,
    status: (automation.status as AutomationStatus) ?? "draft",
    triggerEventName: automation.trigger_event_name ?? "",
  };
  const steps = automation.steps ?? [];
  const trigger = steps.find((s) => s.type === "trigger");
  if (trigger?.config && typeof trigger.config === "object") {
    const eventName = (trigger.config as Record<string, unknown>).event_name;
    if (typeof eventName === "string") state.triggerEventName = eventName;
  }
  const delay = steps.find((s) => s.type === "delay");
  if (delay) {
    state.delayEnabled = true;
    const dur = (delay.config as Record<string, unknown>)?.duration;
    if (typeof dur === "string") state.delayDuration = dur;
  }
  const send = steps.find((s) => s.type === "send_email");
  if (send) {
    const cfg = send.config as Record<string, unknown>;
    const tmpl = cfg.template as { id?: unknown } | undefined;
    if (tmpl && typeof tmpl.id === "string") state.templateId = tmpl.id;
    if (typeof cfg.from === "string") state.fromOverride = cfg.from;
    if (typeof cfg.subject === "string") state.subjectOverride = cfg.subject;
    if (typeof cfg.reply_to === "string") state.replyToOverride = cfg.reply_to;
  }
  return state;
}
