import { type SQL, and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { apiKeys } from "../schema";

export const apiKeyRepo = {
  async findById(id: string, options: { userId?: string } = {}) {
    return await db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.id, id),
        ...(options.userId ? [eq(apiKeys.userId, options.userId)] : []),
      ),
    });
  },

  async findByHash(tokenHash: string) {
    return await db.query.apiKeys.findFirst({
      where: eq(apiKeys.tokenHash, tokenHash),
    });
  },

  async create(data: typeof apiKeys.$inferInsert) {
    return await db.insert(apiKeys).values(data).returning();
  },

  async delete(id: string, options: { userId?: string } = {}) {
    return await db
      .delete(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          ...(options.userId ? [eq(apiKeys.userId, options.userId)] : []),
        ),
      )
      .returning({ id: apiKeys.id });
  },

  async list(
    options: { limit?: number; after?: string; userId?: string } = {},
  ) {
    const { limit = 20, after, userId } = options;
    const conditions: SQL[] = [];

    if (userId) conditions.push(eq(apiKeys.userId, userId));
    if (after) conditions.push(lt(apiKeys.id, after));

    const results = await db
      .select()
      .from(apiKeys)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(apiKeys.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
