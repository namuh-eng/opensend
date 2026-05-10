import { type SQL, and, desc, eq, ilike, lt } from "drizzle-orm";
import { db } from "../client";
import { broadcasts } from "../schema";

export const broadcastRepo = {
  async findById(id: string) {
    return await db.query.broadcasts.findFirst({
      where: eq(broadcasts.id, id),
    });
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.broadcasts.findFirst({
      where: and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)),
    });
  },

  async findDeletionCandidateForUser(id: string, userId: string) {
    const [broadcast] = await db
      .select({ status: broadcasts.status })
      .from(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .limit(1);

    return broadcast;
  },

  async create(data: typeof broadcasts.$inferInsert) {
    return await db.insert(broadcasts).values(data).returning();
  },

  async update(id: string, data: Partial<typeof broadcasts.$inferInsert>) {
    return await db
      .update(broadcasts)
      .set(data)
      .where(eq(broadcasts.id, id))
      .returning();
  },

  async updateForUser(
    id: string,
    userId: string,
    data: Record<string, unknown>,
  ) {
    return await db
      .update(broadcasts)
      .set(data)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .returning();
  },

  async delete(id: string) {
    return await db
      .delete(broadcasts)
      .where(eq(broadcasts.id, id))
      .returning({ id: broadcasts.id });
  },

  async deleteForUser(id: string, userId: string) {
    return await db
      .delete(broadcasts)
      .where(and(eq(broadcasts.id, id), eq(broadcasts.userId, userId)))
      .returning({ id: broadcasts.id });
  },

  async list(
    options: {
      limit?: number;
      after?: string;
      search?: string;
      status?: string;
      segmentId?: string;
    } = {},
  ) {
    const { limit = 40, after, search, status, segmentId } = options;
    const conditions: SQL[] = [];

    if (search) conditions.push(ilike(broadcasts.name, `%${search}%`));
    if (status) conditions.push(eq(broadcasts.status, status));
    if (segmentId) conditions.push(eq(broadcasts.audienceId, segmentId));
    if (after) conditions.push(lt(broadcasts.id, after));

    const results = await db
      .select()
      .from(broadcasts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(broadcasts.id))
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
    status?: string;
    segmentId?: string;
  }) {
    const { userId, limit, after, search, status, segmentId } = options;
    const conditions: SQL[] = [eq(broadcasts.userId, userId)];

    if (search) conditions.push(ilike(broadcasts.name, `%${search}%`));
    if (status) conditions.push(eq(broadcasts.status, status));
    if (segmentId) conditions.push(eq(broadcasts.audienceId, segmentId));
    if (after) conditions.push(lt(broadcasts.id, after));

    const results = await db
      .select({
        id: broadcasts.id,
        name: broadcasts.name,
        status: broadcasts.status,
        audienceId: broadcasts.audienceId,
        topicId: broadcasts.topicId,
        createdAt: broadcasts.createdAt,
        scheduledAt: broadcasts.scheduledAt,
      })
      .from(broadcasts)
      .where(and(...conditions))
      .orderBy(desc(broadcasts.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
