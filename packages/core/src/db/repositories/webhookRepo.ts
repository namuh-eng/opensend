import { type SQL, and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { webhooks } from "../schema";

function ownership(id: string, userId: string | undefined): SQL {
  return userId
    ? (and(eq(webhooks.id, id), eq(webhooks.userId, userId)) as SQL)
    : eq(webhooks.id, id);
}

export const webhookRepo = {
  async findById(id: string, userId?: string) {
    return await db.query.webhooks.findFirst({
      where: ownership(id, userId),
    });
  },

  async create(data: typeof webhooks.$inferInsert) {
    return await db.insert(webhooks).values(data).returning();
  },

  async update(
    id: string,
    data: Partial<typeof webhooks.$inferInsert>,
    userId?: string,
  ) {
    return await db
      .update(webhooks)
      .set(data)
      .where(ownership(id, userId))
      .returning();
  },

  async delete(id: string, userId?: string) {
    return await db
      .delete(webhooks)
      .where(ownership(id, userId))
      .returning({ id: webhooks.id });
  },

  async list(
    options: { limit?: number; after?: string; userId?: string } = {},
  ) {
    const { limit = 20, after, userId } = options;
    const conditions: SQL[] = [];

    if (userId) conditions.push(eq(webhooks.userId, userId));
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
