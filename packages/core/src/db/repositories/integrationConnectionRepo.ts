import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../client";
import { integrationConnections } from "../schema";

function ownedConnectionWhere(id: string, userId: string) {
  return and(
    eq(integrationConnections.id, id),
    eq(integrationConnections.userId, userId),
  );
}

export const integrationConnectionRepo = {
  async create(data: typeof integrationConnections.$inferInsert) {
    const [row] = await db
      .insert(integrationConnections)
      .values(data)
      .returning();
    return row;
  },

  async findById(id: string, userId: string) {
    return await db.query.integrationConnections.findFirst({
      where: ownedConnectionWhere(id, userId),
    });
  },

  async findFirstByProvider(input: { userId: string; provider: "webhook" }) {
    return await db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.userId, input.userId),
        eq(integrationConnections.provider, input.provider),
      ),
      orderBy: desc(integrationConnections.createdAt),
    });
  },

  async list(options: { userId: string; limit?: number; after?: string }) {
    const { userId, limit = 50, after } = options;
    const conditions = [eq(integrationConnections.userId, userId)];

    if (after) conditions.push(lt(integrationConnections.id, after));

    const rows = await db
      .select()
      .from(integrationConnections)
      .where(and(...conditions))
      .orderBy(desc(integrationConnections.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    return { data: hasMore ? rows.slice(0, limit) : rows, hasMore };
  },

  async update(
    id: string,
    userId: string,
    data: Partial<typeof integrationConnections.$inferInsert>,
  ) {
    const [row] = await db
      .update(integrationConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(ownedConnectionWhere(id, userId))
      .returning();
    return row;
  },

  async delete(id: string, userId: string) {
    const [row] = await db
      .delete(integrationConnections)
      .where(ownedConnectionWhere(id, userId))
      .returning({ id: integrationConnections.id });
    return row;
  },
};
