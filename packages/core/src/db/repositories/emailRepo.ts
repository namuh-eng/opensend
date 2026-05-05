import { and, desc, eq, gt, lt, lte } from "drizzle-orm";
import { db } from "../client";
import { emails } from "../schema";

export const emailRepo = {
  async findById(id: string, userId?: string | null) {
    return await db.query.emails.findFirst({
      where: userId
        ? and(eq(emails.id, id), eq(emails.userId, userId))
        : eq(emails.id, id),
    });
  },

  async findByIdempotencyKey(key: string, userId?: string | null) {
    return await db.query.emails.findFirst({
      where: userId
        ? and(eq(emails.idempotencyKey, key), eq(emails.userId, userId))
        : eq(emails.idempotencyKey, key),
    });
  },

  async create(data: typeof emails.$inferInsert) {
    return await db.insert(emails).values(data).returning();
  },

  async update(
    id: string,
    data: Partial<typeof emails.$inferInsert>,
    userId?: string | null,
  ) {
    return await db
      .update(emails)
      .set(data)
      .where(
        userId
          ? and(eq(emails.id, id), eq(emails.userId, userId))
          : eq(emails.id, id),
      )
      .returning();
  },

  async findDueScheduled(options: { limit?: number; now?: Date } = {}) {
    const { limit = 50, now = new Date() } = options;
    return await db
      .select()
      .from(emails)
      .where(and(eq(emails.status, "scheduled"), lte(emails.scheduledAt, now)))
      .limit(limit);
  },

  async list(
    options: {
      limit?: number;
      after?: string;
      before?: string;
      userId?: string;
    } = {},
  ) {
    const { limit = 20, after, before, userId } = options;

    const conditions = [];

    if (userId) conditions.push(eq(emails.userId, userId));
    if (after) conditions.push(gt(emails.id, after));
    else if (before) conditions.push(lt(emails.id, before));

    const results = await db
      .select()
      .from(emails)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emails.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
