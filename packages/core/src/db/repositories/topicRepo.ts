import { type SQL, and, count, desc, eq, ilike, lt } from "drizzle-orm";
import { db } from "../client";
import { topics } from "../schema";

export const topicRepo = {
  async findById(id: string) {
    return await db.query.topics.findFirst({
      where: eq(topics.id, id),
    });
  },

  async create(data: typeof topics.$inferInsert) {
    return await db.insert(topics).values(data).returning();
  },

  async update(id: string, data: Partial<typeof topics.$inferInsert>) {
    return await db
      .update(topics)
      .set(data)
      .where(eq(topics.id, id))
      .returning();
  },

  async delete(id: string) {
    return await db.delete(topics).where(eq(topics.id, id)).returning();
  },

  async list(
    options: { limit?: number; after?: string; search?: string } = {},
  ) {
    const { limit = 20, after, search } = options;
    const conditions: SQL[] = [];

    if (search) conditions.push(ilike(topics.name, `%${search}%`));
    if (after) conditions.push(lt(topics.id, after));

    const results = await db
      .select()
      .from(topics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(topics.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },

  async listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    search?: string;
  }) {
    const conditions: SQL[] = [eq(topics.userId, options.userId)];

    if (options.search)
      conditions.push(ilike(topics.name, `%${options.search}%`));
    if (options.after) conditions.push(lt(topics.id, options.after));

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: topics.id,
        name: topics.name,
        description: topics.description,
        defaultSubscription: topics.defaultSubscription,
        visibility: topics.visibility,
        createdAt: topics.createdAt,
      })
      .from(topics)
      .where(whereClause)
      .orderBy(desc(topics.id))
      .limit(options.limit + 1);

    const [totalRow] = await db
      .select({ count: count() })
      .from(topics)
      .where(whereClause);

    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;

    return { data, hasMore, total: Number(totalRow?.count ?? 0) };
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.topics.findFirst({
      where: and(eq(topics.id, id), eq(topics.userId, userId)),
    });
  },

  async updateForUser(
    id: string,
    userId: string,
    data: Partial<typeof topics.$inferInsert>,
  ) {
    return await db
      .update(topics)
      .set(data)
      .where(and(eq(topics.id, id), eq(topics.userId, userId)))
      .returning();
  },

  async deleteForUser(id: string, userId: string) {
    return await db
      .delete(topics)
      .where(and(eq(topics.id, id), eq(topics.userId, userId)))
      .returning();
  },
};
