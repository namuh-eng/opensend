import { and, asc, desc, eq, ilike, lt } from "drizzle-orm";
import {
  type AutomationConnectionDTO,
  type AutomationStepInput,
  AutomationValidationError,
  type CreateAutomationInput,
  type TriggerStepConfig,
  normalizeStepConfig,
} from "../../dto/automations";
import { db } from "../client";
import {
  type AutomationConnection,
  automationSteps,
  automations,
} from "../schema";

const ALLOWED_STATUSES = new Set(["draft", "enabled", "disabled"]);

const STEP_KEY_PATTERN = /^[A-Za-z0-9_:-]{1,64}$/;
const CONNECTION_TYPES = new Set([
  "default",
  "condition_met",
  "condition_not_met",
]);

export interface ValidatedAutomation {
  triggerEventName: string;
  steps: Array<AutomationStepInput & { config: Record<string, unknown> }>;
  connections: AutomationConnectionDTO[];
}

export function validateAutomationInput(
  input: CreateAutomationInput,
): ValidatedAutomation {
  if (!input || !Array.isArray(input.steps) || input.steps.length === 0) {
    throw new AutomationValidationError(
      "automation requires at least one step",
      "automation_steps_required",
    );
  }

  if (input.status && !ALLOWED_STATUSES.has(input.status)) {
    throw new AutomationValidationError(
      `invalid automation status "${input.status}"`,
      "automation_status_invalid",
    );
  }

  const orderedSteps = [...input.steps].sort((a, b) => {
    const aPos = typeof a.position === "number" ? a.position : 0;
    const bPos = typeof b.position === "number" ? b.position : 0;
    return aPos - bPos;
  });

  if (orderedSteps[0]?.type !== "trigger") {
    throw new AutomationValidationError(
      "first step must be a trigger",
      "trigger_must_be_first",
    );
  }

  const triggerCount = orderedSteps.filter((s) => s.type === "trigger").length;
  if (triggerCount > 1) {
    throw new AutomationValidationError(
      "automation may only contain one trigger step",
      "duplicate_trigger",
    );
  }

  const seenKeys = new Set<string>();
  const normalized: Array<
    AutomationStepInput & { config: Record<string, unknown> }
  > = [];

  for (let index = 0; index < orderedSteps.length; index += 1) {
    const step = orderedSteps[index];
    if (!step.key || !STEP_KEY_PATTERN.test(step.key)) {
      throw new AutomationValidationError(
        `step key "${step.key}" is invalid`,
        "step_key_invalid",
      );
    }
    if (seenKeys.has(step.key)) {
      throw new AutomationValidationError(
        `duplicate step key "${step.key}"`,
        "duplicate_step_key",
      );
    }
    seenKeys.add(step.key);

    const config = normalizeStepConfig(step.type, step.config ?? {});
    normalized.push({
      ...step,
      position: typeof step.position === "number" ? step.position : index,
      config,
    });
  }

  const triggerStep = normalized[0];
  const triggerConfig = triggerStep.config as unknown as TriggerStepConfig;
  const triggerEventName =
    input.triggerEventName ?? triggerConfig.event_name ?? "";
  if (!triggerEventName) {
    throw new AutomationValidationError(
      "trigger step missing event_name",
      "trigger_event_name_required",
    );
  }
  if (
    input.triggerEventName &&
    triggerConfig.event_name &&
    input.triggerEventName !== triggerConfig.event_name
  ) {
    throw new AutomationValidationError(
      "automation triggerEventName disagrees with trigger step event_name",
      "trigger_event_name_mismatch",
    );
  }
  triggerStep.config = { event_name: triggerEventName } as Record<
    string,
    unknown
  >;

  const connections = input.connections ?? [];
  const stepTypesByKey = new Map(
    normalized.map((step) => [step.key, step.type]),
  );
  const seenConnectionBranches = new Set<string>();
  for (const edge of connections) {
    if (!edge || typeof edge.from !== "string" || typeof edge.to !== "string") {
      throw new AutomationValidationError(
        "connection edges must have string from/to",
        "connection_edge_invalid",
      );
    }
    if (
      edge.type !== undefined &&
      (typeof edge.type !== "string" || !CONNECTION_TYPES.has(edge.type))
    ) {
      throw new AutomationValidationError(
        `connection ${edge.from} -> ${edge.to} has invalid branch label`,
        "connection_type_invalid",
      );
    }
    const branchType = edge.type ?? "default";
    if (!seenKeys.has(edge.from) || !seenKeys.has(edge.to)) {
      throw new AutomationValidationError(
        `connection ${edge.from} -> ${edge.to} references unknown step key`,
        "connection_unknown_step",
      );
    }
    const fromStepType = stepTypesByKey.get(edge.from);
    if (branchType !== "default" && fromStepType !== "condition") {
      throw new AutomationValidationError(
        `connection ${edge.from} -> ${edge.to} uses condition branch label from a non-condition step`,
        "connection_branch_from_non_condition",
      );
    }
    const branchKey = `${edge.from}:${branchType}`;
    if (seenConnectionBranches.has(branchKey)) {
      throw new AutomationValidationError(
        `connection from ${edge.from} has duplicate ${branchType} branch`,
        "connection_branch_duplicate",
      );
    }
    seenConnectionBranches.add(branchKey);
    if (edge.from === edge.to) {
      throw new AutomationValidationError(
        `connection ${edge.from} -> ${edge.to} cannot be a self-loop`,
        "connection_self_loop",
      );
    }
  }

  return {
    triggerEventName,
    steps: normalized,
    connections,
  };
}

export interface CreatedAutomation {
  automation: typeof automations.$inferSelect;
  steps: Array<typeof automationSteps.$inferSelect>;
}

export const automationRepo = {
  validate: validateAutomationInput,

  async findById(id: string) {
    return await db.query.automations.findFirst({
      where: eq(automations.id, id),
    });
  },

  async findByIdForUser(id: string, userId?: string | null) {
    const conditions = [eq(automations.id, id)];
    if (userId) conditions.push(eq(automations.userId, userId));

    return await db.query.automations.findFirst({
      where: and(...conditions),
    });
  },

  async findEnabledByTriggerEventName(
    triggerEventName: string,
    userId?: string | null,
  ) {
    const conditions = [
      eq(automations.status, "enabled"),
      eq(automations.triggerEventName, triggerEventName),
    ];
    if (userId) conditions.push(eq(automations.userId, userId));
    return await db.query.automations.findMany({
      where: and(...conditions),
    });
  },

  async listSteps(automationId: string) {
    return await db
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automationId))
      .orderBy(asc(automationSteps.position));
  },

  async create(input: CreateAutomationInput): Promise<CreatedAutomation> {
    const validated = validateAutomationInput(input);

    return await db.transaction(async (tx) => {
      const [automation] = await tx
        .insert(automations)
        .values({
          name: input.name ?? "Untitled",
          status: input.status ?? "draft",
          triggerEventName: validated.triggerEventName,
          connections: validated.connections as AutomationConnection[],
          userId: input.userId ?? null,
          document: input.document as never,
        })
        .returning();

      const stepRows = await tx
        .insert(automationSteps)
        .values(
          validated.steps.map((step, index) => ({
            automationId: automation.id,
            key: step.key,
            type: step.type,
            config: step.config,
            position: typeof step.position === "number" ? step.position : index,
          })),
        )
        .returning();

      return { automation, steps: stepRows };
    });
  },

  async update(id: string, data: Partial<typeof automations.$inferInsert>) {
    return await db
      .update(automations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automations.id, id))
      .returning();
  },

  async delete(id: string) {
    return await db
      .delete(automations)
      .where(eq(automations.id, id))
      .returning({ id: automations.id });
  },

  async list(
    options: {
      limit?: number;
      after?: string;
      status?: string;
      search?: string;
      userId?: string | null;
    } = {},
  ) {
    const { limit = 20, after, status, search, userId } = options;
    const conditions = [];
    if (status) conditions.push(eq(automations.status, status));
    if (search) conditions.push(ilike(automations.name, `%${search}%`));
    if (userId) conditions.push(eq(automations.userId, userId));
    if (after) conditions.push(lt(automations.id, after));

    const results = await db
      .select()
      .from(automations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(automations.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    return { data, hasMore };
  },
};
