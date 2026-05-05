import { type SQL, and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { webhooks } from "../schema";

export const webhookRepo = {
  async findById(id: string, options: { userId?: string } = {}) {
    return await db.query.webhooks.findFirst({
      where: and(
        eq(webhooks.id, id),
        ...(options.userId ? [eq(webhooks.userId, options.userId)] : []),
      ),
    });
  },

  async create(data: typeof webhooks.$inferInsert) {
    return await db.insert(webhooks).values(data).returning();
  },

  async update(
    id: string,
    data: Partial<typeof webhooks.$inferInsert>,
    options: { userId?: string } = {},
  ) {
    return await db
      .update(webhooks)
      .set(data)
      .where(
        and(
          eq(webhooks.id, id),
          ...(options.userId ? [eq(webhooks.userId, options.userId)] : []),
        ),
      )
      .returning();
  },

  async delete(id: string, options: { userId?: string } = {}) {
    return await db
      .delete(webhooks)
      .where(
        and(
          eq(webhooks.id, id),
          ...(options.userId ? [eq(webhooks.userId, options.userId)] : []),
        ),
      )
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
