import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  type CreatedAutomation,
  automationRepo,
} from "../db/repositories/automationRepo";
import {
  type AutomationConnection,
  automationRuns,
  automationSteps,
  automations,
} from "../db/schema";
import type {
  AutomationConnectionDTO,
  AutomationStatus,
  AutomationStepInput,
  CreateAutomationInput,
} from "../dto/automations";

export type AutomationRow = typeof automations.$inferSelect;
export type AutomationStepRow = typeof automationSteps.$inferSelect;
type AutomationInsert = typeof automations.$inferInsert;

type AutomationStepPayload = {
  key: string;
  type: AutomationStepInput["type"];
  config?: Record<string, unknown>;
  position?: number;
};

type AutomationMutationPayload = {
  name?: string;
  status?: AutomationStatus;
  trigger_event_name?: string;
  triggerEventName?: string;
  steps?: AutomationStepPayload[];
  connections?: AutomationConnectionDTO[];
};

export type CreateAutomationServiceInput = {
  userId: string | null;
  data: AutomationMutationPayload & { steps: AutomationStepPayload[] };
};

export type ListAutomationsServiceInput = {
  userId: string | null;
  limit?: number;
  after?: string;
  status?: AutomationStatus;
  search?: string;
};

export type UpdateAutomationServiceInput = {
  userId: string | null;
  id: string;
  data: AutomationMutationPayload;
};

export type AutomationServiceErrorCode = "not_found" | "delete_forbidden";

export class AutomationServiceError extends Error {
  constructor(
    readonly code: AutomationServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AutomationServiceError";
  }
}

export type AutomationDetailResponse = ReturnType<typeof formatAutomation>;
export type AutomationListItemResponse = ReturnType<
  typeof formatAutomationListItem
> & {
  step_count: number;
  last_run: AutomationLastRun | null;
};
export type AutomationListResponse = {
  object: "list";
  data: AutomationListItemResponse[];
  has_more: boolean;
};
export type AutomationDeleteResponse = {
  object: "automation";
  id: string;
  deleted: true;
};

type AutomationLastRun = {
  status: string;
  created_at: Date;
};

export type AutomationServiceRepository = {
  create(input: CreateAutomationInput): Promise<CreatedAutomation>;
  list(input: {
    limit: number;
    after?: string;
    status?: string;
    search?: string;
    userId?: string | null;
  }): Promise<{ data: AutomationRow[]; hasMore: boolean }>;
  findByIdForUser(
    id: string,
    userId?: string | null,
  ): Promise<AutomationRow | undefined>;
  listSteps(automationId: string): Promise<AutomationStepRow[]>;
  validate(input: CreateAutomationInput): {
    triggerEventName: string;
    steps: Array<AutomationStepInput & { config: Record<string, unknown> }>;
    connections: AutomationConnectionDTO[];
  };
  update(id: string, data: Partial<AutomationInsert>): Promise<AutomationRow[]>;
  replaceStepsAndUpdate(input: {
    automationId: string;
    steps: Array<AutomationStepInput & { config: Record<string, unknown> }>;
    update: Partial<AutomationInsert>;
  }): Promise<void>;
  delete(id: string): Promise<Array<{ id: string }>>;
  countStepsByAutomationIds(
    automationIds: string[],
  ): Promise<Map<string, number>>;
  findLastRunsByAutomationIds(
    automationIds: string[],
  ): Promise<Map<string, AutomationLastRun>>;
};

export type AutomationServiceDependencies = {
  repository?: AutomationServiceRepository;
};

function defaultRepository(): AutomationServiceRepository {
  return {
    create: (input) => automationRepo.create(input),
    list: (input) => automationRepo.list(input),
    findByIdForUser: (id, userId) => automationRepo.findByIdForUser(id, userId),
    listSteps: (automationId) => automationRepo.listSteps(automationId),
    validate: (input) => automationRepo.validate(input),
    update: (id, data) => automationRepo.update(id, data),
    delete: (id) => automationRepo.delete(id),
    replaceStepsAndUpdate: async ({ automationId, steps, update }) => {
      await db.transaction(async (tx) => {
        await tx
          .delete(automationSteps)
          .where(eq(automationSteps.automationId, automationId));
        await tx.insert(automationSteps).values(
          steps.map((step) => ({
            automationId,
            key: step.key,
            type: step.type,
            config: step.config,
            position: step.position ?? 0,
          })),
        );
        await tx
          .update(automations)
          .set({ ...update, updatedAt: new Date() })
          .where(eq(automations.id, automationId));
      });
    },
    countStepsByAutomationIds: async (automationIds) => {
      const countsByAutomationId = new Map<string, number>();
      if (automationIds.length === 0) return countsByAutomationId;

      const rows = await db
        .select({
          automationId: automationSteps.automationId,
          total: count(),
        })
        .from(automationSteps)
        .where(inArray(automationSteps.automationId, automationIds))
        .groupBy(automationSteps.automationId);

      for (const row of rows) {
        countsByAutomationId.set(row.automationId, Number(row.total));
      }

      return countsByAutomationId;
    },
    findLastRunsByAutomationIds: async (automationIds) => {
      const lastRunByAutomationId = new Map<string, AutomationLastRun>();
      if (automationIds.length === 0) return lastRunByAutomationId;

      const runs = await db
        .select({
          automationId: automationRuns.automationId,
          status: automationRuns.status,
          createdAt: automationRuns.createdAt,
        })
        .from(automationRuns)
        .where(inArray(automationRuns.automationId, automationIds))
        .orderBy(desc(automationRuns.createdAt));

      for (const run of runs) {
        if (!lastRunByAutomationId.has(run.automationId)) {
          lastRunByAutomationId.set(run.automationId, {
            status: run.status,
            created_at: run.createdAt,
          });
        }
      }

      return lastRunByAutomationId;
    },
  };
}

function toStepInputs(steps: AutomationStepPayload[]): AutomationStepInput[] {
  return steps.map((step) => ({
    key: step.key,
    type: step.type,
    config: step.config ?? {},
    position: step.position,
  }));
}

function toCreateInput(
  input: CreateAutomationServiceInput,
): CreateAutomationInput {
  return {
    name: input.data.name,
    status: input.data.status,
    triggerEventName:
      input.data.trigger_event_name ?? input.data.triggerEventName,
    steps: toStepInputs(input.data.steps),
    connections: input.data.connections,
    userId: input.userId,
  };
}

function formatStep(step: AutomationStepRow) {
  return {
    id: step.id,
    key: step.key,
    type: step.type,
    config: step.config ?? {},
    position: step.position,
  };
}

function formatAutomation(
  automation: AutomationRow,
  steps: AutomationStepRow[],
) {
  const ordered = [...steps].sort((a, b) => a.position - b.position);
  return {
    object: "automation" as const,
    id: automation.id,
    name: automation.name,
    status: automation.status,
    trigger_event_name: automation.triggerEventName,
    connections: automation.connections ?? [],
    steps: ordered.map(formatStep),
    created_at: automation.createdAt,
    updated_at: automation.updatedAt,
  };
}

function formatAutomationListItem(automation: AutomationRow) {
  return {
    object: "automation" as const,
    id: automation.id,
    name: automation.name,
    status: automation.status,
    trigger_event_name: automation.triggerEventName,
    created_at: automation.createdAt,
    updated_at: automation.updatedAt,
  };
}

function toExistingStepInputs(
  steps: AutomationStepRow[],
): AutomationStepInput[] {
  return steps.map((step) => ({
    key: step.key,
    type: step.type as AutomationStepInput["type"],
    config: step.config ?? {},
    position: step.position,
  }));
}

function buildUpdateData(
  input: AutomationMutationPayload,
): Partial<AutomationInsert> {
  const updates: Partial<AutomationInsert> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.status !== undefined) updates.status = input.status;
  if (input.trigger_event_name !== undefined) {
    updates.triggerEventName = input.trigger_event_name;
  }
  if (input.triggerEventName !== undefined) {
    updates.triggerEventName = input.triggerEventName;
  }
  return updates;
}

export function createAutomationService({
  repository = defaultRepository(),
}: AutomationServiceDependencies = {}) {
  async function getExistingOrThrow(id: string, userId: string | null) {
    const automation = await repository.findByIdForUser(id, userId);
    if (!automation) {
      throw new AutomationServiceError("not_found", "Automation not found");
    }
    return automation;
  }

  return {
    async createAutomation(
      input: CreateAutomationServiceInput,
    ): Promise<AutomationDetailResponse> {
      const created = await repository.create(toCreateInput(input));
      return formatAutomation(created.automation, created.steps);
    },

    async listAutomations(
      input: ListAutomationsServiceInput,
    ): Promise<AutomationListResponse> {
      const { data, hasMore } = await repository.list({
        limit: input.limit ?? 25,
        after: input.after,
        status: input.status,
        search: input.search,
        userId: input.userId,
      });
      const automationIds = data.map((automation) => automation.id);
      const [stepCountsByAutomationId, lastRunByAutomationId] =
        await Promise.all([
          repository.countStepsByAutomationIds(automationIds),
          repository.findLastRunsByAutomationIds(automationIds),
        ]);

      return {
        object: "list",
        data: data.map((automation) => ({
          ...formatAutomationListItem(automation),
          step_count: stepCountsByAutomationId.get(automation.id) ?? 0,
          last_run: lastRunByAutomationId.get(automation.id) ?? null,
        })),
        has_more: hasMore,
      };
    },

    async getAutomation(
      userId: string | null,
      id: string,
    ): Promise<AutomationDetailResponse> {
      const automation = await getExistingOrThrow(id, userId);
      return formatAutomation(automation, await repository.listSteps(id));
    },

    async updateAutomation(
      input: UpdateAutomationServiceInput,
    ): Promise<AutomationDetailResponse> {
      const existing = await getExistingOrThrow(input.id, input.userId);

      if (input.data.steps) {
        const normalized = repository.validate({
          name: input.data.name ?? existing.name,
          status: input.data.status ?? (existing.status as AutomationStatus),
          triggerEventName:
            input.data.trigger_event_name ??
            input.data.triggerEventName ??
            existing.triggerEventName ??
            undefined,
          steps: toStepInputs(input.data.steps),
          connections: input.data.connections,
          userId: input.userId,
        });

        await repository.replaceStepsAndUpdate({
          automationId: existing.id,
          steps: normalized.steps,
          update: {
            name: input.data.name ?? existing.name,
            status: input.data.status ?? existing.status,
            triggerEventName: normalized.triggerEventName,
            connections: normalized.connections as AutomationConnection[],
          },
        });
      } else {
        const updates = buildUpdateData(input.data);
        if (input.data.connections !== undefined) {
          const existingSteps = await repository.listSteps(existing.id);
          const normalized = repository.validate({
            name: input.data.name ?? existing.name,
            status: input.data.status ?? (existing.status as AutomationStatus),
            triggerEventName:
              updates.triggerEventName ??
              existing.triggerEventName ??
              undefined,
            steps: toExistingStepInputs(existingSteps),
            connections: input.data.connections,
            userId: input.userId,
          });
          updates.triggerEventName = normalized.triggerEventName;
          updates.connections =
            normalized.connections as AutomationConnection[];
        }
        if (Object.keys(updates).length > 0) {
          await repository.update(existing.id, updates);
        }
      }

      const refreshed = await getExistingOrThrow(input.id, input.userId);
      return formatAutomation(refreshed, await repository.listSteps(input.id));
    },

    async stopAutomation(
      userId: string | null,
      id: string,
    ): Promise<AutomationDetailResponse> {
      const automation = await getExistingOrThrow(id, userId);
      if (automation.status !== "disabled") {
        await repository.update(automation.id, { status: "disabled" });
      }

      const refreshed = await getExistingOrThrow(id, userId);
      return formatAutomation(refreshed, await repository.listSteps(id));
    },

    async deleteAutomation(
      userId: string | null,
      id: string,
    ): Promise<AutomationDeleteResponse> {
      const automation = await getExistingOrThrow(id, userId);
      if (automation.status === "enabled") {
        throw new AutomationServiceError(
          "delete_forbidden",
          "Disable the automation before deleting",
        );
      }

      await repository.delete(automation.id);
      return {
        object: "automation",
        id: automation.id,
        deleted: true,
      };
    },
  };
}
