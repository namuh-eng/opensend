export type AutomationStatus = "draft" | "enabled" | "disabled";

export type AutomationStepType =
  | "trigger"
  | "delay"
  | "send_email"
  | "end"
  // Reserved for future MVPs; runner foundation should ignore until implemented.
  | "condition"
  | "wait_for_event"
  | "contact_update"
  | "add_to_segment";

export type AutomationRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "skipped";

export interface AutomationConnectionDTO {
  from: string;
  to: string;
}

export interface TriggerStepConfig {
  event_name: string;
}

export interface TriggerStepConfigInput {
  event_name?: string;
  eventName?: string;
}

export interface DelayStepConfig {
  duration: string;
}

export interface SendEmailStepConfig {
  template: {
    id: string;
    variables?: Record<string, unknown>;
  };
  from?: string;
  subject?: string;
  reply_to?: string;
}

export type EndStepConfig = Record<string, never>;

export type AutomationStepConfig =
  | TriggerStepConfig
  | DelayStepConfig
  | SendEmailStepConfig
  | EndStepConfig;

export interface AutomationStepInput {
  key: string;
  type: AutomationStepType;
  config: Record<string, unknown>;
  position?: number;
}

export interface CreateAutomationInput {
  name?: string;
  status?: AutomationStatus;
  triggerEventName?: string;
  steps: AutomationStepInput[];
  connections?: AutomationConnectionDTO[];
  userId?: string | null;
  document?: unknown;
}

export interface AutomationStepDTO {
  id: string;
  key: string;
  type: AutomationStepType;
  config: Record<string, unknown>;
  position: number;
}

export interface AutomationDTO {
  id: string;
  name: string;
  status: AutomationStatus;
  triggerEventName: string | null;
  connections: AutomationConnectionDTO[];
  steps: AutomationStepDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomEventDTO {
  id: string;
  name: string;
  schema: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRunStepStateEntry {
  status:
    | "pending"
    | "running"
    | "waiting"
    | "completed"
    | "failed"
    | "skipped";
  startedAt?: string;
  completedAt?: string;
  scheduledFor?: string;
  error?: string;
  output?: Record<string, unknown>;
}

export interface AutomationRunDTO {
  id: string;
  automationId: string;
  triggerEventId: string | null;
  contactId: string | null;
  status: AutomationRunStatus;
  currentStepKey: string | null;
  stepStates: Record<string, AutomationRunStepStateEntry>;
  startedAt: string | null;
  completedAt: string | null;
  nextStepAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const RESERVED_EVENT_PREFIX = "resend:";
const MAX_DELAY_DAYS = 30;
export const MAX_DELAY_SECONDS = MAX_DELAY_DAYS * 24 * 60 * 60;

export class AutomationValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "automation_invalid") {
    super(message);
    this.name = "AutomationValidationError";
    this.code = code;
  }
}

export function assertEventNameAllowed(name: string): void {
  if (!name || !name.trim()) {
    throw new AutomationValidationError(
      "event_name must be a non-empty string",
      "event_name_required",
    );
  }
  if (name.toLowerCase().startsWith(RESERVED_EVENT_PREFIX)) {
    throw new AutomationValidationError(
      `event_name "${name}" uses reserved prefix "${RESERVED_EVENT_PREFIX}"`,
      "event_name_reserved",
    );
  }
}

export function normalizeTriggerConfig(
  raw: TriggerStepConfigInput | Record<string, unknown>,
): TriggerStepConfig {
  const candidate = raw as TriggerStepConfigInput;
  const eventName =
    typeof candidate.event_name === "string"
      ? candidate.event_name
      : typeof candidate.eventName === "string"
        ? candidate.eventName
        : "";
  assertEventNameAllowed(eventName);
  return { event_name: eventName };
}

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

export function parseDurationToSeconds(input: string): number {
  if (typeof input !== "string") {
    throw new AutomationValidationError(
      "delay duration must be a string",
      "delay_duration_invalid",
    );
  }

  const match = DURATION_PATTERN.exec(input);
  if (!match) {
    throw new AutomationValidationError(
      `delay duration "${input}" is not a recognized natural-language duration`,
      "delay_duration_invalid",
    );
  }

  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const factor = UNIT_TO_SECONDS[unit];
  if (!Number.isFinite(amount) || amount <= 0 || !factor) {
    throw new AutomationValidationError(
      `delay duration "${input}" must be a positive amount`,
      "delay_duration_invalid",
    );
  }

  const seconds = Math.round(amount * factor);
  if (seconds > MAX_DELAY_SECONDS) {
    throw new AutomationValidationError(
      `delay duration "${input}" exceeds the ${MAX_DELAY_DAYS}-day cap`,
      "delay_duration_too_long",
    );
  }
  return seconds;
}

export function normalizeDelayConfig(
  raw: Record<string, unknown>,
): DelayStepConfig {
  const duration = typeof raw.duration === "string" ? raw.duration : "";
  parseDurationToSeconds(duration);
  return { duration };
}

export function normalizeSendEmailConfig(
  raw: Record<string, unknown>,
): SendEmailStepConfig {
  const template =
    (raw.template as { id?: unknown; variables?: unknown }) ?? {};
  if (typeof template.id !== "string" || !template.id.trim()) {
    throw new AutomationValidationError(
      "send_email step requires config.template.id",
      "send_email_template_id_required",
    );
  }

  const config: SendEmailStepConfig = { template: { id: template.id } };
  if (
    template.variables !== undefined &&
    template.variables !== null &&
    typeof template.variables === "object"
  ) {
    config.template.variables = template.variables as Record<string, unknown>;
  }
  if (typeof raw.from === "string") config.from = raw.from;
  if (typeof raw.subject === "string") config.subject = raw.subject;
  if (typeof raw.reply_to === "string") config.reply_to = raw.reply_to;
  return config;
}

export function normalizeStepConfig(
  type: AutomationStepType,
  config: Record<string, unknown>,
): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return normalizeTriggerConfig(config) as unknown as Record<
        string,
        unknown
      >;
    case "delay":
      return normalizeDelayConfig(config) as unknown as Record<string, unknown>;
    case "send_email":
      return normalizeSendEmailConfig(config) as unknown as Record<
        string,
        unknown
      >;
    case "end":
      return {};
    default:
      // Reserved step types pass through unchanged; runner is not built yet.
      return config;
  }
}
