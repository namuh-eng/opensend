import { type SQL, and, count, desc, eq, ilike, lt } from "drizzle-orm";
import { db } from "../client";
import { segments } from "../schema";

export const segmentRepo = {
  async findById(id: string) {
    return await db.query.segments.findFirst({
      where: eq(segments.id, id),
    });
  },

  async findByName(name: string) {
    return await db.query.segments.findFirst({
      where: eq(segments.name, name),
    });
  },

  async create(data: typeof segments.$inferInsert) {
    return await db.insert(segments).values(data).returning();
  },

  async delete(id: string) {
    return await db.delete(segments).where(eq(segments.id, id)).returning();
  },

  async list(
    options: { limit?: number; after?: string; search?: string } = {},
  ) {
    const { limit = 20, after, search } = options;
    const conditions: SQL[] = [];

    if (search) conditions.push(ilike(segments.name, `%${search}%`));
    if (after) conditions.push(lt(segments.id, after));

    const results = await db
      .select()
      .from(segments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(segments.id))
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
    const conditions: SQL[] = [eq(segments.userId, options.userId)];

    if (options.search)
      conditions.push(ilike(segments.name, `%${options.search}%`));
    if (options.after) conditions.push(lt(segments.id, options.after));

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: segments.id,
        name: segments.name,
        createdAt: segments.createdAt,
      })
      .from(segments)
      .where(whereClause)
      .orderBy(desc(segments.id))
      .limit(options.limit + 1);

    const [totalRow] = await db
      .select({ count: count() })
      .from(segments)
      .where(whereClause);

    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;

    return { data, hasMore, total: Number(totalRow?.count ?? 0) };
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.segments.findFirst({
      where: and(eq(segments.id, id), eq(segments.userId, userId)),
    });
  },

  async deleteForUser(id: string, userId: string) {
    return await db
      .delete(segments)
      .where(and(eq(segments.id, id), eq(segments.userId, userId)))
      .returning();
  },
};
