import { and, asc, desc, eq, lt, lte } from "drizzle-orm";
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
    const { limit = 25, after } = options;
    const conditions = [eq(automationRuns.automationId, automationId)];
    if (after) conditions.push(lt(automationRuns.id, after));

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
            : undefined,
        ),
      )
      .orderBy(asc(automationRuns.nextStepAt))
      .limit(limit);

    if (statuses.length <= 1) return rows;
    const allowed = new Set(statuses);
    return rows.filter((row) => allowed.has(row.status));
  },

  async update(id: string, data: Partial<typeof automationRuns.$inferInsert>) {
    return await db
      .update(automationRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationRuns.id, id))
      .returning();
  },
};
