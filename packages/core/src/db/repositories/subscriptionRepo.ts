import { eq } from "drizzle-orm";
import { db } from "../client";
import { subscriptions } from "../schema";

export const subscriptionRepo = {
  async findById(id: string) {
    return await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });
  },

  async findByUserId(userId: string) {
    return await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });
  },

  async findByStripeSubscriptionId(stripeSubscriptionId: string) {
    return await db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId),
    });
  },

  async create(data: typeof subscriptions.$inferInsert) {
    const [row] = await db.insert(subscriptions).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    const [row] = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return row;
  },

  async upsertByUserId(
    userId: string,
    data: Omit<typeof subscriptions.$inferInsert, "userId">,
  ) {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return await this.update(existing.id, data);
    }
    return await this.create({ ...data, userId });
  },
};
