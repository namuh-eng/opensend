import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { webhooks } from "../schema";

function ownedWebhookWhere(id: string, userId: string) {
  return and(eq(webhooks.id, id), eq(webhooks.userId, userId));
}

export const webhookRepo = {
  async findById(id: string, userId: string) {
    return await db.query.webhooks.findFirst({
      where: ownedWebhookWhere(id, userId),
    });
  },

  async findByIdForDispatch(id: string) {
    return await db.query.webhooks.findFirst({
      where: eq(webhooks.id, id),
    });
  },

  async create(data: typeof webhooks.$inferInsert) {
    return await db.insert(webhooks).values(data).returning();
  },

  async update(
    id: string,
    userId: string,
    data: Partial<typeof webhooks.$inferInsert>,
  ) {
    return await db
      .update(webhooks)
      .set(data)
      .where(ownedWebhookWhere(id, userId))
      .returning();
  },

  async delete(id: string, userId: string) {
    return await db
      .delete(webhooks)
      .where(ownedWebhookWhere(id, userId))
      .returning({ id: webhooks.id });
  },

  async list(options: { userId: string; limit?: number; after?: string }) {
    const { userId, limit = 20, after } = options;
    const conditions = [eq(webhooks.userId, userId)];

    if (after) conditions.push(lt(webhooks.id, after));

    const results = await db
      .select()
      .from(webhooks)
      .where(and(...conditions))
      .orderBy(desc(webhooks.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },

  /**
   * SECURITY: cross-tenant by design. The webhook dispatcher needs to scan
   * every endpoint in the system to fan out an event, so this method
   * deliberately omits a userId filter. Do NOT call from user-facing API
   * routes — those must use `list({ userId, ... })` which scopes by owner.
   * Callers must already be running in a trusted server-side context.
   */
  async listForDispatch(options: { limit?: number; after?: string } = {}) {
    const { limit = 20, after } = options;
    const conditions = [];

    if (after) conditions.push(lt(webhooks.id, after));

    const results = await db
      .select()
      .from(webhooks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(webhooks.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
