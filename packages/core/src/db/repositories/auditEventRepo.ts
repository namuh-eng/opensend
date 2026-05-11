import { type SQL, and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents } from "../schema";

export const auditEventRepo = {
  async create(data: typeof auditEvents.$inferInsert) {
    const [created] = await db.insert(auditEvents).values(data).returning();
    return created;
  },

  async listForUser(options: {
    userId: string;
    limit: number;
    action?: string;
    targetType?: string;
    source?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
  }) {
    const conditions: SQL[] = [eq(auditEvents.userId, options.userId)];

    if (options.action) {
      conditions.push(eq(auditEvents.action, options.action));
    }
    if (options.targetType) {
      conditions.push(eq(auditEvents.targetType, options.targetType));
    }
    if (options.source) {
      conditions.push(eq(auditEvents.source, options.source));
    }
    if (options.dateFrom) {
      conditions.push(gte(auditEvents.createdAt, options.dateFrom));
    }
    if (options.dateTo) {
      conditions.push(lte(auditEvents.createdAt, options.dateTo));
    }
    if (options.search) {
      const term = `%${options.search}%`;
      conditions.push(
        or(
          ilike(auditEvents.action, term),
          ilike(auditEvents.targetType, term),
          ilike(auditEvents.targetId, term),
          ilike(auditEvents.actorId, term),
          ilike(auditEvents.actorEmail, term),
          sql`${auditEvents.metadata}::text ILIKE ${term}`,
        ) as SQL,
      );
    }

    return await db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(options.limit);
  },
};
