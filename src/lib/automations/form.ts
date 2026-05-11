export type AutomationStatus = "draft" | "enabled" | "disabled";

export type AutomationAdvancedStepType =
  | "condition"
  | "wait_for_event"
  | "contact_update"
  | "contact_delete"
  | "add_to_segment";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equal"
  | "less_than"
  | "less_than_or_equal"
  | "contains"
  | "exists";

type AutomationStepType =
  | "trigger"
  | "delay"
  | "send_email"
  | "end"
  | AutomationAdvancedStepType;

export interface AutomationFormStep {
  key: string;
  type: AutomationStepType;
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
  advancedStepEnabled: boolean;
  advancedStepType: AutomationAdvancedStepType;
  conditionLeft: string;
  conditionOperator: ConditionOperator;
  conditionRight: string;
  waitForEventName: string;
  waitForEventTimeoutSeconds: string;
  contactUpdateEmail: string;
  contactUpdateFirstName: string;
  contactUpdateLastName: string;
  contactUpdateUnsubscribed: "" | "true" | "false";
  contactUpdatePropertiesJson: string;
  addToSegmentId: string;
  contactDeleteConfirmed: boolean;
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
  advancedStepEnabled: false,
  advancedStepType: "condition",
  conditionLeft: "event.plan",
  conditionOperator: "equals",
  conditionRight: "pro",
  waitForEventName: "",
  waitForEventTimeoutSeconds: "",
  contactUpdateEmail: "",
  contactUpdateFirstName: "",
  contactUpdateLastName: "",
  contactUpdateUnsubscribed: "",
  contactUpdatePropertiesJson: "",
  addToSegmentId: "",
  contactDeleteConfirmed: false,
};

export function parseAutomationScalar(
  value: string,
): string | number | boolean | null {
  const trimmed = value.trim();
  if (trimmed === "null") return null;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function parseScalarRecord(
  value: string,
): Record<string, string | number | boolean | null> | null {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const record: Record<string, string | number | boolean | null> = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (!key.trim() || !isScalar(item)) return null;
      record[key.trim()] = item;
    }
    return record;
  } catch {
    return null;
  }
}

function contactUpdateConfig(
  state: AutomationFormState,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (state.contactUpdateEmail.trim())
    fields.email = state.contactUpdateEmail.trim();
  if (state.contactUpdateFirstName.trim()) {
    fields.first_name = state.contactUpdateFirstName.trim();
  }
  if (state.contactUpdateLastName.trim()) {
    fields.last_name = state.contactUpdateLastName.trim();
  }
  if (state.contactUpdateUnsubscribed) {
    fields.unsubscribed = state.contactUpdateUnsubscribed === "true";
  }

  const config: Record<string, unknown> = {};
  if (Object.keys(fields).length > 0) config.fields = fields;
  const properties = parseScalarRecord(state.contactUpdatePropertiesJson);
  if (properties && Object.keys(properties).length > 0) {
    config.properties = properties;
  }
  return config;
}

function buildAdvancedStep(
  state: AutomationFormState,
  position: number,
): AutomationFormStep {
  switch (state.advancedStepType) {
    case "condition": {
      const predicate: Record<string, unknown> = {
        left: state.conditionLeft.trim(),
        operator: state.conditionOperator,
      };
      if (state.conditionOperator !== "exists") {
        predicate.right = parseAutomationScalar(state.conditionRight);
      }
      return {
        key: "condition",
        type: "condition",
        config: { predicate },
        position,
      };
    }
    case "wait_for_event": {
      const config: Record<string, unknown> = {
        event_name: state.waitForEventName.trim(),
      };
      if (state.waitForEventTimeoutSeconds.trim()) {
        config.timeout_seconds = Number(
          state.waitForEventTimeoutSeconds.trim(),
        );
      }
      return {
        key: "wait_for_event",
        type: "wait_for_event",
        config,
        position,
      };
    }
    case "contact_update":
      return {
        key: "contact_update",
        type: "contact_update",
        config: contactUpdateConfig(state),
        position,
      };
    case "contact_delete":
      return {
        key: "contact_delete",
        type: "contact_delete",
        config: {},
        position,
      };
    case "add_to_segment":
      return {
        key: "add_to_segment",
        type: "add_to_segment",
        config: { segment_id: state.addToSegmentId.trim() },
        position,
      };
  }
}

function shouldIncludeSendEmail(state: AutomationFormState): boolean {
  return !(
    state.advancedStepEnabled && state.advancedStepType === "contact_delete"
  );
}

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

  if (state.advancedStepEnabled) {
    steps.push(buildAdvancedStep(state, position++));
  }

  if (shouldIncludeSendEmail(state)) {
    const sendConfig: Record<string, unknown> = {
      template: { id: state.templateId },
    };
    if (state.fromOverride.trim()) sendConfig.from = state.fromOverride.trim();
    if (state.subjectOverride.trim()) {
      sendConfig.subject = state.subjectOverride.trim();
    }
    if (state.replyToOverride.trim()) {
      sendConfig.reply_to = state.replyToOverride.trim();
    }

    steps.push({
      key: "send_email",
      type: "send_email",
      config: sendConfig,
      position: position++,
    });
  }

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
  type?: "default" | "condition_met" | "condition_not_met";
}> {
  const order: string[] = ["trigger"];
  if (state.delayEnabled) order.push("delay");

  if (state.advancedStepEnabled) {
    order.push(state.advancedStepType);
    if (state.advancedStepType === "condition") {
      return [
        ...order.slice(0, -1).map((from, index) => ({
          from,
          to: order[index + 1],
        })),
        { from: "condition", to: "send_email", type: "condition_met" },
        { from: "condition", to: "end", type: "condition_not_met" },
        { from: "send_email", to: "end" },
      ];
    }
    if (state.advancedStepType === "contact_delete") {
      order.push("end");
    } else {
      order.push("send_email", "end");
    }
  } else {
    order.push("send_email", "end");
  }

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
const CONDITION_PATH_PATTERN =
  /^(event|contact)\.[A-Za-z0-9_.-]+$|^steps\.[A-Za-z0-9_:-]+\.output(\.[A-Za-z0-9_.-]+)?$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTACT_UPDATE_RESERVED_PROPERTY_KEYS = new Set([
  "email",
  "first_name",
  "firstName",
  "last_name",
  "lastName",
  "unsubscribed",
  "segments",
  "topics",
  "topic_subscriptions",
  "topicSubscriptions",
]);

function validateDuration(
  duration: string,
  field: keyof AutomationFormState,
  errors: AutomationFormValidationError[],
  label: string,
): void {
  const match = DURATION_PATTERN.exec(duration);
  if (!match) {
    errors.push({
      field,
      message: `${label} must be a natural-language duration like "1 hour" or "3 days".`,
    });
    return;
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const factor = UNIT_TO_SECONDS[unit];
  if (!Number.isFinite(amount) || amount <= 0 || !factor) {
    errors.push({ field, message: `${label} must be a positive duration.` });
    return;
  }

  const seconds = Math.round(amount * factor);
  if (seconds > MAX_DELAY_SECONDS) {
    errors.push({ field, message: `${label} must be 30 days or less.` });
  }
}

function validateContactUpdateProperties(
  propertiesJson: string,
  errors: AutomationFormValidationError[],
): boolean {
  if (!propertiesJson.trim()) return true;
  const properties = parseScalarRecord(propertiesJson);
  if (!properties) {
    errors.push({
      field: "contactUpdatePropertiesJson",
      message:
        "Properties must be a JSON object with string, number, boolean, or null values.",
    });
    return false;
  }
  for (const key of Object.keys(properties)) {
    if (CONTACT_UPDATE_RESERVED_PROPERTY_KEYS.has(key)) {
      errors.push({
        field: "contactUpdatePropertiesJson",
        message: `Properties cannot modify reserved contact field "${key}".`,
      });
      return false;
    }
  }
  return true;
}

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
    validateDuration(state.delayDuration, "delayDuration", errors, "Delay");
  }

  if (shouldIncludeSendEmail(state) && !state.templateId) {
    errors.push({
      field: "templateId",
      message: "Pick a published template to send.",
    });
  }

  if (state.advancedStepEnabled) {
    if (state.advancedStepType === "condition") {
      if (!CONDITION_PATH_PATTERN.test(state.conditionLeft.trim())) {
        errors.push({
          field: "conditionLeft",
          message:
            "Condition left side must reference event.*, contact.*, or steps.<key>.output.*.",
        });
      }
      if (
        state.conditionOperator !== "exists" &&
        !state.conditionRight.trim()
      ) {
        errors.push({
          field: "conditionRight",
          message:
            "Condition right value is required unless the operator is exists.",
        });
      }
    }

    if (state.advancedStepType === "wait_for_event") {
      if (!state.waitForEventName.trim()) {
        errors.push({
          field: "waitForEventName",
          message: "Event to wait for is required.",
        });
      }
      if (state.waitForEventTimeoutSeconds.trim()) {
        const timeout = Number(state.waitForEventTimeoutSeconds.trim());
        if (
          !Number.isInteger(timeout) ||
          timeout < 1 ||
          timeout > MAX_DELAY_SECONDS
        ) {
          errors.push({
            field: "waitForEventTimeoutSeconds",
            message:
              "Timeout must be a whole number of seconds between 1 and 2,592,000.",
          });
        }
      }
    }

    if (state.advancedStepType === "contact_update") {
      const hasFieldUpdate = Boolean(
        state.contactUpdateEmail.trim() ||
          state.contactUpdateFirstName.trim() ||
          state.contactUpdateLastName.trim() ||
          state.contactUpdateUnsubscribed,
      );
      const propertiesValid = validateContactUpdateProperties(
        state.contactUpdatePropertiesJson,
        errors,
      );
      const properties = parseScalarRecord(state.contactUpdatePropertiesJson);
      const hasProperties = Boolean(
        properties && Object.keys(properties).length > 0,
      );
      if (propertiesValid && !hasFieldUpdate && !hasProperties) {
        errors.push({
          field: "contactUpdateEmail",
          message: "Contact update requires at least one field or property.",
        });
      }
    }

    if (
      state.advancedStepType === "contact_delete" &&
      !state.contactDeleteConfirmed
    ) {
      errors.push({
        field: "contactDeleteConfirmed",
        message:
          "Confirm that this automation may permanently delete the matched contact.",
      });
    }

    if (state.advancedStepType === "add_to_segment") {
      if (!UUID_PATTERN.test(state.addToSegmentId.trim())) {
        errors.push({
          field: "addToSegmentId",
          message: "Segment ID must be a UUID.",
        });
      }
    }
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringifyProperties(value: unknown): string {
  const record = asRecord(value);
  if (!record || Object.keys(record).length === 0) return "";
  return JSON.stringify(record, null, 2);
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
  const advanced = steps.find((s) =>
    [
      "condition",
      "wait_for_event",
      "contact_update",
      "contact_delete",
      "add_to_segment",
    ].includes(s.type),
  );
  if (advanced) {
    state.advancedStepEnabled = true;
    state.advancedStepType = advanced.type as AutomationAdvancedStepType;
    const cfg = advanced.config as Record<string, unknown>;
    if (advanced.type === "condition") {
      const predicate = asRecord(cfg.predicate);
      if (predicate) {
        if (typeof predicate.left === "string")
          state.conditionLeft = predicate.left;
        if (typeof predicate.operator === "string") {
          state.conditionOperator = predicate.operator as ConditionOperator;
        }
        if ("right" in predicate)
          state.conditionRight = String(predicate.right ?? "null");
      }
    }
    if (advanced.type === "wait_for_event") {
      if (typeof cfg.event_name === "string")
        state.waitForEventName = cfg.event_name;
      if (typeof cfg.timeout_seconds === "number") {
        state.waitForEventTimeoutSeconds = String(cfg.timeout_seconds);
      }
    }
    if (advanced.type === "contact_update") {
      const fields = asRecord(cfg.fields);
      if (fields) {
        if (typeof fields.email === "string")
          state.contactUpdateEmail = fields.email;
        if (typeof fields.first_name === "string") {
          state.contactUpdateFirstName = fields.first_name;
        }
        if (typeof fields.last_name === "string") {
          state.contactUpdateLastName = fields.last_name;
        }
        if (typeof fields.unsubscribed === "boolean") {
          state.contactUpdateUnsubscribed = fields.unsubscribed
            ? "true"
            : "false";
        }
      }
      state.contactUpdatePropertiesJson = stringifyProperties(cfg.properties);
    }
    if (advanced.type === "contact_delete") {
      state.contactDeleteConfirmed = true;
    }
    if (
      advanced.type === "add_to_segment" &&
      typeof cfg.segment_id === "string"
    ) {
      state.addToSegmentId = cfg.segment_id;
    }
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
