import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lt,
  lte,
} from "drizzle-orm";
import { AutomationValidationError } from "../../dto/automations";
import { db } from "../client";
import { automationRuns, automations } from "../schema";

export interface CreateAutomationRunInput {
  automationId: string;
  triggerEventId?: string | null;
  contactId?: string | null;
  userId?: string | null;
  initialStepKey?: string | null;
}

export const automationRunRepo = {
  async findById(id: string) {
    return await db.query.automationRuns.findFirst({
      where: eq(automationRuns.id, id),
    });
  },

  async createFromTrigger(input: CreateAutomationRunInput) {
    if (!input.automationId) {
      throw new AutomationValidationError(
        "automationId is required to create a run",
        "automation_id_required",
      );
    }

    const automation = await db.query.automations.findFirst({
      where: eq(automations.id, input.automationId),
    });

    if (!automation) {
      throw new AutomationValidationError(
        `automation ${input.automationId} not found`,
        "automation_not_found",
      );
    }

    if (automation.status !== "enabled") {
      throw new AutomationValidationError(
        `automation ${input.automationId} is not enabled`,
        "automation_not_enabled",
      );
    }

    const [run] = await db
      .insert(automationRuns)
      .values({
        automationId: input.automationId,
        triggerEventId: input.triggerEventId ?? null,
        contactId: input.contactId ?? null,
        userId: input.userId ?? automation.userId ?? null,
        status: "queued",
        currentStepKey: input.initialStepKey ?? null,
        stepStates: {},
        nextStepAt: new Date(),
      })
      .returning();

    return run;
  },

  async listByAutomationId(
    automationId: string,
    options: { limit?: number; after?: string } = {},
  ) {
    return await this.listForApi({
      automationId,
      statuses: [],
      limit: options.limit ?? 25,
      after: options.after,
    });
  },

  async listForApi(input: {
    automationId: string;
    statuses?: readonly string[];
    limit?: number;
    after?: string;
  }) {
    const limit = input.limit ?? 25;
    const conditions: SQL[] = [
      eq(automationRuns.automationId, input.automationId),
    ];
    const statuses = input.statuses ?? [];
    if (statuses.length === 1) {
      conditions.push(eq(automationRuns.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(automationRuns.status, [...statuses]));
    }
    if (input.after) conditions.push(lt(automationRuns.id, input.after));

    const results = await db
      .select()
      .from(automationRuns)
      .where(and(...conditions))
      .orderBy(desc(automationRuns.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    return { data, hasMore };
  },

  async findByIdForAutomation(runId: string, automationId: string) {
    return await db.query.automationRuns.findFirst({
      where: and(
        eq(automationRuns.id, runId),
        eq(automationRuns.automationId, automationId),
      ),
    });
  },

  async cancelForApi(input: {
    runId: string;
    automationId: string;
    stepStates: NonNullable<(typeof automationRuns.$inferInsert)["stepStates"]>;
    failureReason: string;
    completedAt: Date;
    cancellableStatuses: readonly string[];
  }) {
    const [updated] = await db
      .update(automationRuns)
      .set({
        status: "cancelled",
        stepStates: input.stepStates,
        completedAt: input.completedAt,
        nextStepAt: null,
        failureReason: input.failureReason,
        updatedAt: input.completedAt,
      })
      .where(
        and(
          eq(automationRuns.id, input.runId),
          eq(automationRuns.automationId, input.automationId),
          inArray(automationRuns.status, [...input.cancellableStatuses]),
        ),
      )
      .returning();

    return updated;
  },

  async listForMetrics(input: {
    automationId: string;
    from?: Date;
    to?: Date;
  }) {
    const conditions: SQL[] = [
      eq(automationRuns.automationId, input.automationId),
    ];
    if (input.from) conditions.push(gte(automationRuns.createdAt, input.from));
    if (input.to) conditions.push(lte(automationRuns.createdAt, input.to));

    return await db
      .select()
      .from(automationRuns)
      .where(and(...conditions));
  },

  async listWaitingByContact(input: {
    contactId: string;
    userId?: string | null;
    limit?: number;
  }) {
    const conditions = [
      eq(automationRuns.status, "waiting"),
      eq(automationRuns.contactId, input.contactId),
    ];
    if (input.userId) conditions.push(eq(automationRuns.userId, input.userId));

    return await db
      .select()
      .from(automationRuns)
      .where(and(...conditions))
      .orderBy(asc(automationRuns.updatedAt))
      .limit(input.limit ?? 50);
  },

  async listDue(
    options: { limit?: number; statuses?: string[]; before?: Date } = {},
  ) {
    const { limit = 50, statuses = ["queued", "waiting"], before } = options;
    const cursor = before ?? new Date();

    const rows = await db
      .select()
      .from(automationRuns)
      .where(
        and(
          lte(automationRuns.nextStepAt, cursor),
          statuses.length === 1
            ? eq(automationRuns.status, statuses[0])
            : inArray(automationRuns.status, statuses),
        ),
      )
      .orderBy(asc(automationRuns.nextStepAt))
      .limit(limit);

    return rows;
  },

  async update(id: string, data: Partial<typeof automationRuns.$inferInsert>) {
    return await db
      .update(automationRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationRuns.id, id))
      .returning();
  },
};
