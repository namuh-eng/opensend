import { asc, eq } from "drizzle-orm";
import { FREE_PLAN_DEFAULTS, FREE_PLAN_SLUG } from "../../dto";
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

  async ensureFreePlan() {
    const [row] = await db
      .insert(plans)
      .values({
        slug: FREE_PLAN_DEFAULTS.slug,
        name: FREE_PLAN_DEFAULTS.name,
        monthlyPriceCents: FREE_PLAN_DEFAULTS.monthlyPriceCents,
        monthlyEmailQuota: FREE_PLAN_DEFAULTS.monthlyEmailQuota,
        maxDomains: FREE_PLAN_DEFAULTS.maxDomains,
        maxApiKeys: FREE_PLAN_DEFAULTS.maxApiKeys,
        isPublic: FREE_PLAN_DEFAULTS.isPublic,
      })
      .onConflictDoNothing({ target: plans.slug })
      .returning();

    if (row) return row;

    const existing = await this.findBySlug(FREE_PLAN_SLUG);
    if (!existing) {
      throw new Error("Free plan ensure failed: insert ignored but no row");
    }
    return existing;
  },
};
