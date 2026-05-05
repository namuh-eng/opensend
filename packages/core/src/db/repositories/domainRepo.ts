import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { domains } from "../schema";

export const domainRepo = {
  async findById(id: string) {
    return await db.query.domains.findFirst({
      where: eq(domains.id, id),
    });
  },

  async findByName(name: string) {
    return await db.query.domains.findFirst({
      where: eq(domains.name, name),
    });
  },

  async create(data: typeof domains.$inferInsert) {
    return await db.insert(domains).values(data).returning();
  },

  async update(id: string, data: Partial<typeof domains.$inferInsert>) {
    return await db
      .update(domains)
      .set(data)
      .where(eq(domains.id, id))
      .returning();
  },

  async delete(id: string) {
    return await db
      .delete(domains)
      .where(eq(domains.id, id))
      .returning({ id: domains.id });
  },

  async list(
    options: { limit?: number; after?: string; userId?: string | null } = {},
  ) {
    const { limit = 20, after, userId } = options;
    const conditions = [];

    if (after) conditions.push(lt(domains.id, after));
    if (userId) conditions.push(eq(domains.userId, userId));

    const results = await db
      .select()
      .from(domains)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(domains.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
