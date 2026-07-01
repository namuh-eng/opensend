import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import { plans } from "../schema";

export const planRepo = {
  async findById(id: string) {
    return await db.query.plans.findFirst({ where: eq(plans.id, id) });
  },

  async findBySlug(slug: string) {
    return await db.query.plans.findFirst({ where: eq(plans.slug, slug) });
  },

  async create(data: typeof plans.$inferInsert) {
    const [row] = await db.insert(plans).values(data).returning();
    return row;
  },

  async list() {
    return await db.select().from(plans).orderBy(asc(plans.monthlyPriceCents));
  },

  async listPublic() {
    return await db
      .select()
      .from(plans)
      .where(eq(plans.isPublic, true))
      .orderBy(asc(plans.monthlyPriceCents));
  },
};
