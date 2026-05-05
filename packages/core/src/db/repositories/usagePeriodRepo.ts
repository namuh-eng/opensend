import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { usagePeriods } from "../schema";

export const usagePeriodRepo = {
  async findByUserAndPeriod(userId: string, periodStart: Date) {
    return await db.query.usagePeriods.findFirst({
      where: and(
        eq(usagePeriods.userId, userId),
        eq(usagePeriods.periodStart, periodStart),
      ),
    });
  },

  async create(data: typeof usagePeriods.$inferInsert) {
    const [row] = await db.insert(usagePeriods).values(data).returning();
    return row;
  },

  async ensure(userId: string, periodStart: Date, periodEnd: Date) {
    const existing = await this.findByUserAndPeriod(userId, periodStart);
    if (existing) return existing;
    return await this.create({
      userId,
      periodStart,
      periodEnd,
      emailsSent: 0,
    });
  },

  async incrementEmailsSent(id: string, delta = 1) {
    const [row] = await db
      .update(usagePeriods)
      .set({
        emailsSent: sql`${usagePeriods.emailsSent} + ${delta}`,
        lastIncrementAt: new Date(),
      })
      .where(eq(usagePeriods.id, id))
      .returning();
    return row;
  },
};
