import { eq } from "drizzle-orm";
import { db } from "../client";
import { stripeCustomers } from "../schema";

export const stripeCustomerRepo = {
  async findByUserId(userId: string) {
    return await db.query.stripeCustomers.findFirst({
      where: eq(stripeCustomers.userId, userId),
    });
  },

  async findByStripeCustomerId(stripeCustomerId: string) {
    return await db.query.stripeCustomers.findFirst({
      where: eq(stripeCustomers.stripeCustomerId, stripeCustomerId),
    });
  },

  async create(data: typeof stripeCustomers.$inferInsert) {
    const [row] = await db.insert(stripeCustomers).values(data).returning();
    return row;
  },

  async ensureForUser(userId: string, stripeCustomerId: string) {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const [row] = await db
      .insert(stripeCustomers)
      .values({ userId, stripeCustomerId })
      .onConflictDoNothing({ target: stripeCustomers.userId })
      .returning();
    if (row) return row;

    const reloaded = await this.findByUserId(userId);
    if (!reloaded) {
      throw new Error(
        "Stripe customer ensure failed: insert ignored but no row",
      );
    }
    return reloaded;
  },
};
