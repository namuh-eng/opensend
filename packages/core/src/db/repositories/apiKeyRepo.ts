import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { apiKeys } from "../schema";

function ownedApiKeyWhere(id: string, userId: string) {
  return and(eq(apiKeys.id, id), eq(apiKeys.userId, userId));
}

export const apiKeyRepo = {
  async findById(id: string, userId: string) {
    return await db.query.apiKeys.findFirst({
      where: ownedApiKeyWhere(id, userId),
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

  async delete(id: string, userId: string) {
    return await db
      .delete(apiKeys)
      .where(ownedApiKeyWhere(id, userId))
      .returning({ id: apiKeys.id });
  },

  async list(options: { userId: string; limit?: number; after?: string }) {
    const { userId, limit = 20, after } = options;
    const conditions = [eq(apiKeys.userId, userId)];

    if (after) conditions.push(lt(apiKeys.id, after));

    const results = await db
      .select()
      .from(apiKeys)
      .where(and(...conditions))
      .orderBy(desc(apiKeys.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
