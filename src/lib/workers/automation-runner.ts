import { db } from "@/lib/db";
import {
  type AutomationConnection,
  type AutomationStepStateEntry,
  type automationRuns,
  automationSteps,
  automations,
  contacts,
  contactsToSegments,
  customEventDeliveries,
  segments,
  templates,
} from "@/lib/db/schema";
import {
  StoredTemplateRendererConfigError,
  getStoredTemplateRendererConfig,
  renderStoredTemplateContent,
} from "@/lib/templates/stored-renderer";
import {
  type ConditionOperator,
  type ConditionStepConfig,
  type ContactUpdateStepConfig,
  TemplateRendererError,
  type WaitForEventStepConfig,
  automationRunRepo,
  emailService,
  normalizeAddToSegmentConfig,
  normalizeConditionConfig,
  normalizeContactDeleteConfig,
  normalizeContactUpdateConfig,
  normalizeWaitForEventConfig,
  parseDurationToCappedSeconds,
} from "@opensend/core";
import { and, asc, eq } from "drizzle-orm";

type AutomationRun = typeof automationRuns.$inferSelect;
type Automation = typeof automations.$inferSelect;
type AutomationStep = typeof automationSteps.$inferSelect;
type CustomEventDelivery = typeof customEventDeliveries.$inferSelect;
type Contact = typeof contacts.$inferSelect;
type Template = typeof templates.$inferSelect;
type Segment = typeof segments.$inferSelect;

type StepStates = Record<string, AutomationStepStateEntry>;

type RunnerSendEmailInput = {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string[];
  tags?: Array<{ name: string; value: string }>;
  idempotencyKey?: string | null;
  userId?: string | null;
};

export interface AutomationRunnerDeps {
  now: () => Date;
  getAutomation: (id: string) => Promise<Automation | null>;
  listSteps: (automationId: string) => Promise<AutomationStep[]>;
  getDelivery: (id: string) => Promise<CustomEventDelivery | null>;
  getContact: (id: string) => Promise<Contact | null>;
  getTemplate: (id: string) => Promise<Template | null>;
  sendEmail: (input: RunnerSendEmailInput) => Promise<{ id: string }>;
  updateContact: (
    id: string,
    data: Partial<typeof contacts.$inferInsert>,
  ) => Promise<Contact | null>;
  deleteContact: (id: string) => Promise<{ id: string } | null>;
  getSegment: (id: string, userId?: string | null) => Promise<Segment | null>;
  addContactToSegmentMembership: (input: {
    contactId: string;
    segmentId: string;
    segmentName: string;
    userId?: string | null;
  }) => Promise<{ added: boolean }>;
  listWaitingRunsByContact: (input: {
    contactId: string;
    userId?: string | null;
    limit?: number;
  }) => Promise<AutomationRun[]>;
  updateRun: (
    id: string,
    data: Partial<typeof automationRuns.$inferInsert>,
  ) => Promise<AutomationRun | null>;
}

export interface ProcessScheduledAutomationsResult {
  processed: number;
  advanced: number;
  failed: number;
  skipped: number;
}

const defaultDeps: AutomationRunnerDeps = {
  now: () => new Date(),
  async getAutomation(id) {
    return (
      (await db.query.automations.findFirst({
        where: eq(automations.id, id),
      })) ?? null
    );
  },
  async listSteps(automationId) {
    return await db
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automationId))
      .orderBy(asc(automationSteps.position));
  },
  async getDelivery(id) {
    return (
      (await db.query.customEventDeliveries.findFirst({
        where: eq(customEventDeliveries.id, id),
      })) ?? null
    );
  },
  async getContact(id) {
    return (
      (await db.query.contacts.findFirst({ where: eq(contacts.id, id) })) ??
      null
    );
  },
  async getTemplate(id) {
    return (
      (await db.query.templates.findFirst({ where: eq(templates.id, id) })) ??
      null
    );
  },
  async sendEmail(input) {
    return await emailService.send(input);
  },
  async updateContact(id, data) {
    const [updated] = await db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id))
      .returning();
    return updated ?? null;
  },
  async deleteContact(id) {
    const [deleted] = await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
    return deleted ?? null;
  },

  async getSegment(id, userId) {
    const conditions = [eq(segments.id, id)];
    if (userId) conditions.push(eq(segments.userId, userId));
    return (
      (await db.query.segments.findFirst({
        where: conditions.length === 1 ? conditions[0] : and(...conditions),
      })) ?? null
    );
  },
  async addContactToSegmentMembership({
    contactId,
    segmentId,
    segmentName,
    userId,
  }) {
    const inserted = await db
      .insert(contactsToSegments)
      .values({ contactId, segmentId })
      .onConflictDoNothing()
      .returning({ contactId: contactsToSegments.contactId });
    const added = inserted.length > 0;

    // Legacy contacts.segments array remains the source of truth for the
    // broadcast worker; keep both representations aligned until the legacy
    // path is removed.
    const contact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
    });
    if (contact) {
      const existing = (contact.segments as string[] | null) ?? [];
      if (!existing.includes(segmentName)) {
        const updatedSegments = [...existing, segmentName];
        const conditions = [eq(contacts.id, contactId)];
        if (userId) conditions.push(eq(contacts.userId, userId));
        await db
          .update(contacts)
          .set({ segments: updatedSegments })
          .where(conditions.length === 1 ? conditions[0] : and(...conditions));
      }
    }

    return { added };
  },
  async listWaitingRunsByContact(input) {
    return await automationRunRepo.listWaitingByContact(input);
  },
  async updateRun(id, data) {
    const [updated] = await automationRunRepo.update(id, data);
    return updated ?? null;
  },
};

function iso(date: Date): string {
  return date.toISOString();
}

function cloneStepStates(run: AutomationRun): StepStates {
  return { ...(run.stepStates ?? {}) };
}

function setStepState(
  states: StepStates,
  key: string,
  patch: AutomationStepStateEntry,
): StepStates {
  return {
    ...states,
    [key]: {
      ...(states[key] ?? { status: "pending" }),
      ...patch,
    },
  };
}

function findStep(
  steps: AutomationStep[],
  key: string | null,
): AutomationStep | null {
  if (key) return steps.find((step) => step.key === key) ?? null;
  return steps.find((step) => step.type === "trigger") ?? steps[0] ?? null;
}

function nextStepKey(
  automation: Automation,
  steps: AutomationStep[],
  currentKey: string,
  branch: AutomationConnection["type"] = "default",
): string | null {
  const connections = (automation.connections ?? []) as AutomationConnection[];
  const connected =
    connections.find((edge) => edge.from === currentKey && edge.type === branch)
      ?.to ??
    connections.find(
      (edge) =>
        edge.from === currentKey &&
        (edge.type === "default" || edge.type === undefined),
    )?.to;
  if (connected && steps.some((step) => step.key === connected)) {
    return connected;
  }

  const ordered = [...steps].sort((a, b) => a.position - b.position);
  const currentIndex = ordered.findIndex((step) => step.key === currentKey);
  if (currentIndex < 0) return null;
  return ordered[currentIndex + 1]?.key ?? null;
}

async function advanceRun(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  automation: Automation,
  steps: AutomationStep[],
  step: AutomationStep,
  states: StepStates,
  now: Date,
  output?: Record<string, unknown>,
  branch: AutomationConnection["type"] = "default",
) {
  const nextKey = nextStepKey(automation, steps, step.key, branch);
  const completedStates = setStepState(states, step.key, {
    status: "completed",
    completedAt: iso(now),
    ...(output ? { output } : {}),
  });

  const startedAtPatch =
    step.type === "trigger" && !run.startedAt ? { startedAt: now } : {};

  if (!nextKey) {
    return await deps.updateRun(run.id, {
      status: "completed",
      currentStepKey: null,
      stepStates: completedStates,
      completedAt: now,
      nextStepAt: null,
      failureReason: null,
      ...startedAtPatch,
    });
  }

  return await deps.updateRun(run.id, {
    status: "queued",
    currentStepKey: nextKey,
    stepStates: completedStates,
    nextStepAt: now,
    failureReason: null,
    ...startedAtPatch,
  });
}

async function failRun(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  stepKey: string,
  states: StepStates,
  now: Date,
  reason: string,
) {
  const failedStates = setStepState(states, stepKey, {
    status: "failed",
    completedAt: iso(now),
    error: reason,
  });
  return await deps.updateRun(run.id, {
    status: "failed",
    currentStepKey: stepKey,
    stepStates: failedStates,
    completedAt: now,
    nextStepAt: null,
    failureReason: reason,
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPath(source: unknown, path: string[]): unknown {
  let current = source;
  for (const part of path) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function buildVariableContext(
  delivery: CustomEventDelivery | null,
  contact: Contact,
  states: StepStates = {},
): Record<string, unknown> {
  const eventPayload = delivery?.payload ?? {};
  const customProperties = contact.customProperties ?? {};
  const contactContext: Record<string, unknown> = {
    id: contact.id,
    email: contact.email,
    first_name: contact.firstName ?? "",
    firstName: contact.firstName ?? "",
    last_name: contact.lastName ?? "",
    lastName: contact.lastName ?? "",
    unsubscribed: contact.unsubscribed,
    custom_properties: customProperties,
    customProperties,
  };

  return {
    ...(typeof eventPayload === "object" && eventPayload !== null
      ? eventPayload
      : {}),
    ...customProperties,
    email: contact.email,
    first_name: contact.firstName ?? "",
    firstName: contact.firstName ?? "",
    last_name: contact.lastName ?? "",
    lastName: contact.lastName ?? "",
    event: eventPayload,
    contact: contactContext,
    steps: buildStepOutputContext(states),
    wait_events: buildWaitEventContext(states),
  };
}

function resolveReference(
  value: unknown,
  context: Record<string, unknown>,
): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const directPath =
    /^(event|contact|wait_events|steps)\.([A-Za-z0-9_.:-]+)$/.exec(trimmed);
  if (directPath) {
    return getPath(context[directPath[1]], directPath[2].split("."));
  }
  return value.replace(
    /{{{\s*([^}]+?)\s*}}}|{{\s*([^}]+?)\s*}}/g,
    (
      match,
      tripleToken: string | undefined,
      doubleToken: string | undefined,
    ) => {
      if (tripleToken !== undefined) return match;
      const token = doubleToken ?? "";
      const path = token.trim().split(".");
      const resolved = getPath(context, path);
      return resolved === undefined || resolved === null
        ? ""
        : String(resolved);
    },
  );
}

function normalizeReplyTo(value: string | null): string[] | undefined {
  return value ? [value] : undefined;
}

function legacyAutomationRenderVariables(
  variables: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(variables)
      .filter(([, value]) => typeof value !== "object")
      .map(([key, value]) => [key, value === undefined ? "" : value]),
  );
}

function templateRenderFailureReason(error: unknown): string | null {
  if (error instanceof TemplateRendererError) {
    return `send_email template render failed: ${error.message}`;
  }
  if (error instanceof StoredTemplateRendererConfigError) {
    return `send_email template render failed: ${error.message}`;
  }
  return null;
}

function getSendEmailConfig(step: AutomationStep): {
  templateId: string | null;
  variables: Record<string, unknown>;
  from: string | null;
  subject: string | null;
  replyTo: string | null;
} {
  const config = step.config ?? {};
  const template =
    typeof config.template === "object" && config.template !== null
      ? (config.template as Record<string, unknown>)
      : {};
  const variables =
    typeof template.variables === "object" && template.variables !== null
      ? (template.variables as Record<string, unknown>)
      : {};
  return {
    templateId: readString(template.id),
    variables,
    from: readString(config.from),
    subject: readString(config.subject),
    replyTo: readString(config.reply_to),
  };
}

function buildStepOutputContext(states: StepStates): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(states).map(([key, state]) => [
      key,
      { output: state.output ?? {} },
    ]),
  );
}

function buildWaitEventContext(states: StepStates): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(states)
      .filter(([, state]) => state.output?.waited_event !== undefined)
      .map(([key, state]) => [key, state.output?.waited_event ?? {}]),
  );
}

function buildConditionContext(
  delivery: CustomEventDelivery | null,
  contact: Contact | null,
  states: StepStates,
): Record<string, unknown> {
  const eventPayload = delivery?.payload ?? {};
  const contactContext = contact
    ? {
        id: contact.id,
        email: contact.email,
        first_name: contact.firstName ?? "",
        firstName: contact.firstName ?? "",
        last_name: contact.lastName ?? "",
        lastName: contact.lastName ?? "",
        unsubscribed: contact.unsubscribed,
        custom_properties: contact.customProperties ?? {},
        customProperties: contact.customProperties ?? {},
      }
    : null;

  return {
    event: eventPayload,
    contact: contactContext,
    steps: buildStepOutputContext(states),
  };
}

function resolveConditionPath(
  context: Record<string, unknown>,
  path: string,
): unknown {
  const stepMatch = /^steps\.([A-Za-z0-9_:-]+)\.output(?:\.(.+))?$/.exec(path);
  if (stepMatch) {
    const stepContext = getPath(context.steps, [stepMatch[1], "output"]);
    return stepMatch[2]
      ? getPath(stepContext, stepMatch[2].split("."))
      : stepContext;
  }

  const [root, ...parts] = path.split(".");
  return getPath(context[root], parts);
}

function toComparable(value: unknown): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new Error(
    "condition predicate left resolved to a non-comparable value",
  );
}

function compareNumbers(
  left: string | number | boolean | null,
  right: string | number | boolean | null | undefined,
  operator: ConditionOperator,
): boolean {
  const leftNumber = typeof left === "number" ? left : Number(left);
  const rightNumber = typeof right === "number" ? right : Number(right);
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) {
    throw new Error(`condition ${operator} requires numeric operands`);
  }
  if (operator === "greater_than") return leftNumber > rightNumber;
  if (operator === "greater_than_or_equal") return leftNumber >= rightNumber;
  if (operator === "less_than") return leftNumber < rightNumber;
  return leftNumber <= rightNumber;
}

function evaluateConditionPredicate(
  config: ConditionStepConfig,
  context: Record<string, unknown>,
): boolean {
  const leftRaw = resolveConditionPath(context, config.predicate.left);
  if (leftRaw === undefined) {
    throw new Error(`condition variable not found: ${config.predicate.left}`);
  }

  const left = toComparable(leftRaw);
  const right = config.predicate.right;
  switch (config.predicate.operator) {
    case "exists":
      return left !== null;
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "greater_than":
    case "greater_than_or_equal":
    case "less_than":
    case "less_than_or_equal":
      return compareNumbers(left, right, config.predicate.operator);
    case "contains":
      if (typeof left !== "string" || typeof right !== "string") {
        throw new Error("condition contains requires string operands");
      }
      return left.includes(right);
  }
}

async function processConditionStep(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  automation: Automation,
  steps: AutomationStep[],
  step: AutomationStep,
  states: StepStates,
  now: Date,
) {
  const config = normalizeConditionConfig(step.config ?? {});
  const delivery = run.triggerEventId
    ? await deps.getDelivery(run.triggerEventId)
    : null;
  const contact = run.contactId ? await deps.getContact(run.contactId) : null;
  const matched = evaluateConditionPredicate(
    config,
    buildConditionContext(delivery, contact, states),
  );
  const branch = matched ? "condition_met" : "condition_not_met";

  return await advanceRun(
    deps,
    run,
    automation,
    steps,
    step,
    states,
    now,
    { matched, branch },
    branch,
  );
}

function scheduledTimeoutFor(
  now: Date,
  config: WaitForEventStepConfig,
): Date | null {
  return typeof config.timeout_seconds === "number"
    ? new Date(now.getTime() + config.timeout_seconds * 1000)
    : null;
}

async function processWaitForEventStep(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  step: AutomationStep,
  states: StepStates,
  now: Date,
) {
  const config = normalizeWaitForEventConfig(step.config ?? {});
  const existing = run.stepStates?.[step.key];
  if (existing?.status === "waiting") {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      `wait_for_event timed out waiting for ${config.event_name}`,
    );
  }

  if (!run.contactId) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "wait_for_event requires a contact",
    );
  }

  const scheduledFor = scheduledTimeoutFor(now, config);
  const waitingStates = setStepState(states, step.key, {
    status: "waiting",
    ...(scheduledFor ? { scheduledFor: iso(scheduledFor) } : {}),
    output: {
      waiting_for_event: config.event_name,
      ...(scheduledFor ? { timeout_at: iso(scheduledFor) } : {}),
    },
  });
  return await deps.updateRun(run.id, {
    status: "waiting",
    currentStepKey: step.key,
    stepStates: waitingStates,
    nextStepAt: scheduledFor,
    failureReason: null,
  });
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: unknown }).code === "23505") {
    return true;
  }
  return "cause" in error && isUniqueViolation(error.cause);
}

function resolveContactUpdateScalar(
  value: unknown,
  context: Record<string, unknown>,
): unknown {
  return resolveReference(value, context);
}

function toOptionalString(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`contact_update ${field} must resolve to a string or null`);
  }
  return value.trim() || null;
}

function toRequiredEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(
      "contact_update email must resolve to a valid email string",
    );
  }
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 512) {
    throw new Error(
      "contact_update email must resolve to a valid email string",
    );
  }
  return email;
}

function toBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`contact_update ${field} must resolve to a boolean`);
  }
  return value;
}

function toPropertyString(value: unknown, key: string): string {
  if (value === null) return "";
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    typeof value !== "boolean"
  ) {
    throw new Error(
      `contact_update property ${key} must resolve to a string, number, boolean, or null`,
    );
  }
  return String(value);
}

function buildContactUpdate(
  config: ContactUpdateStepConfig,
  contact: Contact,
  context: Record<string, unknown>,
): {
  data: Partial<typeof contacts.$inferInsert>;
  changedFields: string[];
} {
  const data: Partial<typeof contacts.$inferInsert> = {};
  const changedFields = new Set<string>();
  const fields = config.fields ?? {};

  if ("email" in fields) {
    const email = toRequiredEmail(
      resolveContactUpdateScalar(fields.email, context),
    );
    if (email !== contact.email) {
      data.email = email;
      changedFields.add("email");
    }
  }

  if ("first_name" in fields) {
    const firstName = toOptionalString(
      resolveContactUpdateScalar(fields.first_name, context),
      "first_name",
    );
    if ((contact.firstName ?? null) !== firstName) {
      data.firstName = firstName;
      changedFields.add("first_name");
    }
  }

  if ("last_name" in fields) {
    const lastName = toOptionalString(
      resolveContactUpdateScalar(fields.last_name, context),
      "last_name",
    );
    if ((contact.lastName ?? null) !== lastName) {
      data.lastName = lastName;
      changedFields.add("last_name");
    }
  }

  if ("unsubscribed" in fields) {
    const unsubscribed = toBoolean(
      resolveContactUpdateScalar(fields.unsubscribed, context),
      "unsubscribed",
    );
    if (contact.unsubscribed !== unsubscribed) {
      data.unsubscribed = unsubscribed;
      changedFields.add("unsubscribed");
    }
  }

  if (config.properties) {
    const currentProperties = contact.customProperties ?? {};
    const nextProperties: Record<string, string> = { ...currentProperties };
    let propertiesChanged = false;
    for (const [key, rawValue] of Object.entries(config.properties)) {
      const value = toPropertyString(
        resolveContactUpdateScalar(rawValue, context),
        key,
      );
      if (nextProperties[key] !== value) {
        nextProperties[key] = value;
        propertiesChanged = true;
        changedFields.add(`properties.${key}`);
      }
    }
    if (propertiesChanged) {
      data.customProperties = nextProperties;
    }
  }

  return { data, changedFields: [...changedFields] };
}

async function processContactUpdateStep(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  automation: Automation,
  steps: AutomationStep[],
  step: AutomationStep,
  states: StepStates,
  now: Date,
) {
  if (!run.contactId) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "contact_update requires a contact",
    );
  }

  const contact = await deps.getContact(run.contactId);
  if (!contact) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "contact_update contact not found",
    );
  }

  const config = normalizeContactUpdateConfig(step.config ?? {});
  const delivery = run.triggerEventId
    ? await deps.getDelivery(run.triggerEventId)
    : null;
  const context = buildVariableContext(delivery, contact, states);
  const { data, changedFields } = buildContactUpdate(config, contact, context);

  if (changedFields.length > 0) {
    try {
      const updated = await deps.updateContact(contact.id, data);
      if (!updated) {
        return await failRun(
          deps,
          run,
          step.key,
          states,
          now,
          "contact_update contact not found",
        );
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        return await failRun(
          deps,
          run,
          step.key,
          states,
          now,
          "contact_update email already exists",
        );
      }
      throw error;
    }
  }

  return await advanceRun(deps, run, automation, steps, step, states, now, {
    contact_id: contact.id,
    changed_fields: changedFields,
  });
}

async function processContactDeleteStep(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  step: AutomationStep,
  states: StepStates,
  now: Date,
) {
  normalizeContactDeleteConfig(step.config ?? {});

  if (!run.contactId) {
    const skippedStates = setStepState(states, step.key, {
      status: "skipped",
      startedAt: states[step.key]?.startedAt ?? iso(now),
      completedAt: iso(now),
      output: { reason: "contact_already_deleted" },
    });
    return await deps.updateRun(run.id, {
      status: "completed",
      currentStepKey: null,
      stepStates: skippedStates,
      completedAt: now,
      nextStepAt: null,
      failureReason: null,
    });
  }

  const contact = await deps.getContact(run.contactId);
  if (!contact) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "contact_delete contact not found",
    );
  }

  const deleted = await deps.deleteContact(contact.id);
  if (!deleted) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "contact_delete contact not found",
    );
  }

  const completedStates = setStepState(states, step.key, {
    status: "completed",
    completedAt: iso(now),
    output: { deleted_contact_id: deleted.id },
  });
  return await deps.updateRun(run.id, {
    status: "completed",
    currentStepKey: null,
    stepStates: completedStates,
    completedAt: now,
    nextStepAt: null,
    failureReason: null,
    contactId: null,
  });
}

async function processAddToSegmentStep(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  automation: Automation,
  steps: AutomationStep[],
  step: AutomationStep,
  states: StepStates,
  now: Date,
) {
  if (!run.contactId) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "add_to_segment requires a contact",
    );
  }

  const contact = await deps.getContact(run.contactId);
  if (!contact) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "add_to_segment contact not found",
    );
  }

  const config = normalizeAddToSegmentConfig(step.config ?? {});
  const userId = run.userId ?? automation.userId ?? null;
  const segment = await deps.getSegment(config.segment_id, userId);
  if (!segment) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "add_to_segment segment not found",
    );
  }

  const { added } = await deps.addContactToSegmentMembership({
    contactId: contact.id,
    segmentId: segment.id,
    segmentName: segment.name,
    userId,
  });

  return await advanceRun(deps, run, automation, steps, step, states, now, {
    segment_id: segment.id,
    added,
  });
}

async function processSendEmailStep(
  deps: AutomationRunnerDeps,
  run: AutomationRun,
  automation: Automation,
  steps: AutomationStep[],
  step: AutomationStep,
  states: StepStates,
  now: Date,
) {
  if (!run.contactId) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "send_email requires a contact",
    );
  }

  const contact = await deps.getContact(run.contactId);
  if (!contact) {
    return await failRun(deps, run, step.key, states, now, "contact not found");
  }

  if (contact.unsubscribed) {
    const nextKey = nextStepKey(automation, steps, step.key);
    const skippedStates = setStepState(states, step.key, {
      status: "skipped",
      startedAt: states[step.key]?.startedAt ?? iso(now),
      completedAt: iso(now),
      output: { reason: "contact_unsubscribed", contact_id: contact.id },
    });
    if (!nextKey) {
      return await deps.updateRun(run.id, {
        status: "completed",
        currentStepKey: null,
        stepStates: skippedStates,
        completedAt: now,
        nextStepAt: null,
        failureReason: null,
      });
    }
    return await deps.updateRun(run.id, {
      status: "queued",
      currentStepKey: nextKey,
      stepStates: skippedStates,
      nextStepAt: now,
      failureReason: null,
    });
  }

  const config = getSendEmailConfig(step);
  if (!config.templateId) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "send_email step missing template id",
    );
  }

  const template = await deps.getTemplate(config.templateId);
  if (!template || template.status !== "published") {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "send_email template is missing or unpublished",
    );
  }

  const delivery = run.triggerEventId
    ? await deps.getDelivery(run.triggerEventId)
    : null;
  const context = buildVariableContext(delivery, contact, states);
  const explicitVariables = Object.fromEntries(
    Object.entries(config.variables).map(([key, value]) => [
      key,
      resolveReference(value, context),
    ]),
  );
  const variables = { ...context, ...explicitVariables };
  const from = String(
    resolveReference(config.from ?? template.from ?? "", context) ?? "",
  ).trim();
  const subjectSource = config.subject ?? template.subject;
  const subjectOverride =
    subjectSource === null || subjectSource === undefined
      ? undefined
      : String(resolveReference(subjectSource, context) ?? "");
  const replyTo = String(
    resolveReference(config.replyTo ?? template.replyTo ?? "", context) ?? "",
  ).trim();

  let renderedTemplate: { subject: string; html: string; text: string };
  try {
    const rendererConfig = getStoredTemplateRendererConfig(template.document);
    renderedTemplate = await renderStoredTemplateContent({
      template,
      subject: subjectOverride,
      variables:
        rendererConfig.kind === "legacy"
          ? legacyAutomationRenderVariables(variables)
          : variables,
    });
  } catch (error) {
    const reason = templateRenderFailureReason(error);
    if (reason) {
      return await failRun(deps, run, step.key, states, now, reason);
    }
    throw error;
  }

  const subject = renderedTemplate.subject.trim();

  if (!from) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "send_email from address is missing",
    );
  }
  if (!subject) {
    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      "send_email subject is missing",
    );
  }

  const email = await deps.sendEmail({
    from,
    to: [contact.email],
    subject,
    html: renderedTemplate.html,
    text: renderedTemplate.text,
    replyTo: normalizeReplyTo(replyTo),
    tags: [
      { name: "automation_id", value: automation.id },
      { name: "automation_run_id", value: run.id },
    ],
    idempotencyKey: `automation:${run.id}:${step.key}`,
    userId: run.userId ?? automation.userId ?? null,
  });

  return await advanceRun(deps, run, automation, steps, step, states, now, {
    email_id: email.id,
  });
}

export async function processAutomationRunStep(
  run: AutomationRun,
  deps: AutomationRunnerDeps = defaultDeps,
): Promise<AutomationRun | null> {
  if (run.status !== "queued" && run.status !== "waiting") {
    return run;
  }

  const now = deps.now();
  const automation = await deps.getAutomation(run.automationId);
  if (!automation) {
    return await deps.updateRun(run.id, {
      status: "failed",
      completedAt: now,
      nextStepAt: null,
      failureReason: "automation not found",
    });
  }

  const steps = await deps.listSteps(run.automationId);
  const step = findStep(steps, run.currentStepKey);
  if (!step) {
    return await deps.updateRun(run.id, {
      status: "completed",
      currentStepKey: null,
      completedAt: now,
      nextStepAt: null,
    });
  }

  const states = setStepState(cloneStepStates(run), step.key, {
    status: "running",
    startedAt: run.stepStates?.[step.key]?.startedAt ?? iso(now),
  });

  try {
    if (step.type === "trigger") {
      return await advanceRun(deps, run, automation, steps, step, states, now);
    }

    if (step.type === "delay") {
      const existing = run.stepStates?.[step.key];
      if (existing?.status === "waiting") {
        return await advanceRun(
          deps,
          run,
          automation,
          steps,
          step,
          states,
          now,
        );
      }

      const duration = readString(step.config?.duration);
      if (!duration) {
        return await failRun(
          deps,
          run,
          step.key,
          states,
          now,
          "delay duration is missing",
        );
      }
      const seconds = parseDurationToCappedSeconds(duration);
      const scheduledFor = new Date(now.getTime() + seconds * 1000);
      const waitingStates = setStepState(states, step.key, {
        status: "waiting",
        scheduledFor: iso(scheduledFor),
      });
      return await deps.updateRun(run.id, {
        status: "waiting",
        currentStepKey: step.key,
        stepStates: waitingStates,
        nextStepAt: scheduledFor,
        failureReason: null,
      });
    }

    if (step.type === "condition") {
      return await processConditionStep(
        deps,
        run,
        automation,
        steps,
        step,
        states,
        now,
      );
    }

    if (step.type === "wait_for_event") {
      return await processWaitForEventStep(deps, run, step, states, now);
    }

    if (step.type === "contact_update") {
      return await processContactUpdateStep(
        deps,
        run,
        automation,
        steps,
        step,
        states,
        now,
      );
    }

    if (step.type === "contact_delete") {
      return await processContactDeleteStep(deps, run, step, states, now);
    }

    if (step.type === "add_to_segment") {
      return await processAddToSegmentStep(
        deps,
        run,
        automation,
        steps,
        step,
        states,
        now,
      );
    }

    if (step.type === "send_email") {
      return await processSendEmailStep(
        deps,
        run,
        automation,
        steps,
        step,
        states,
        now,
      );
    }

    if (step.type === "end") {
      const completedStates = setStepState(states, step.key, {
        status: "completed",
        completedAt: iso(now),
      });
      return await deps.updateRun(run.id, {
        status: "completed",
        currentStepKey: null,
        stepStates: completedStates,
        completedAt: now,
        nextStepAt: null,
        failureReason: null,
      });
    }

    return await failRun(
      deps,
      run,
      step.key,
      states,
      now,
      `unsupported automation step type: ${step.type}`,
    );
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "automation step failed";
    return await failRun(deps, run, step.key, states, now, reason);
  }
}

function waitedEventOutput(
  delivery: CustomEventDelivery,
  matchedAt: Date,
): Record<string, unknown> {
  return {
    delivery_id: delivery.id,
    event_name: delivery.eventName,
    payload: delivery.payload ?? {},
    contact_id: delivery.contactId,
    email: delivery.email,
    received_at: iso(delivery.receivedAt),
    matched_at: iso(matchedAt),
  };
}

export async function resumeWaitingRunsForEvent(
  delivery: CustomEventDelivery,
  deps: AutomationRunnerDeps = defaultDeps,
): Promise<AutomationRun[]> {
  if (!delivery.contactId) return [];

  const now = deps.now();
  const waitingRuns = await deps.listWaitingRunsByContact({
    contactId: delivery.contactId,
    userId: delivery.userId,
    limit: 50,
  });
  const resumed: AutomationRun[] = [];

  for (const run of waitingRuns) {
    if (run.contactId !== delivery.contactId || !run.currentStepKey) continue;

    const automation = await deps.getAutomation(run.automationId);
    if (!automation) continue;

    const steps = await deps.listSteps(run.automationId);
    const step = findStep(steps, run.currentStepKey);
    if (!step || step.type !== "wait_for_event") continue;

    const existing = run.stepStates?.[step.key];
    if (existing?.status !== "waiting" || existing.output?.waited_event) {
      continue;
    }

    const config = normalizeWaitForEventConfig(step.config ?? {});
    if (config.event_name !== delivery.eventName) continue;

    const states = setStepState(cloneStepStates(run), step.key, {
      status: "running",
      startedAt: existing.startedAt ?? iso(now),
    });
    const updated = await advanceRun(
      deps,
      run,
      automation,
      steps,
      step,
      states,
      now,
      {
        ...(existing.output ?? {}),
        waited_event: waitedEventOutput(delivery, now),
      },
    );
    if (updated) resumed.push(updated);
  }

  return resumed;
}

export async function processScheduledAutomations(
  options: { limit?: number; now?: Date } = {},
): Promise<ProcessScheduledAutomationsResult> {
  const now = options.now ?? new Date();
  const due = await automationRunRepo.listDue({
    limit: options.limit ?? 50,
    statuses: ["queued", "waiting"],
    before: now,
  });

  const result: ProcessScheduledAutomationsResult = {
    processed: due.length,
    advanced: 0,
    failed: 0,
    skipped: 0,
  };

  for (const run of due) {
    const updated = await processAutomationRunStep(run, {
      ...defaultDeps,
      now: () => now,
    });
    if (updated?.status === "failed") result.failed += 1;
    else if (updated) result.advanced += 1;

    const states = updated?.stepStates ?? {};
    if (Object.values(states).some((state) => state.status === "skipped")) {
      result.skipped += 1;
    }
  }

  return result;
}
