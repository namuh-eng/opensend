import { and, asc, eq } from "drizzle-orm";
import {
  type AutomationStepType,
  AutomationValidationError,
  normalizeStepConfig,
} from "../../dto/automations";
import { db } from "../client";
import { automationSteps } from "../schema";

export const automationStepRepo = {
  async findById(id: string) {
    return await db.query.automationSteps.findFirst({
      where: eq(automationSteps.id, id),
    });
  },

  async findByAutomationAndKey(automationId: string, key: string) {
    return await db.query.automationSteps.findFirst({
      where: and(
        eq(automationSteps.automationId, automationId),
        eq(automationSteps.key, key),
      ),
    });
  },

  async listByAutomationId(automationId: string) {
    return await db
      .select()
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automationId))
      .orderBy(asc(automationSteps.position));
  },

  async update(id: string, data: Partial<typeof automationSteps.$inferInsert>) {
    if (data.type && data.config) {
      normalizeStepConfig(
        data.type as AutomationStepType,
        data.config as Record<string, unknown>,
      );
    } else if (data.config && !data.type) {
      throw new AutomationValidationError(
        "step config update requires the step type for validation",
        "step_update_type_required",
      );
    }
    return await db
      .update(automationSteps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationSteps.id, id))
      .returning();
  },

  async delete(id: string) {
    return await db
      .delete(automationSteps)
      .where(eq(automationSteps.id, id))
      .returning({ id: automationSteps.id });
  },
};
