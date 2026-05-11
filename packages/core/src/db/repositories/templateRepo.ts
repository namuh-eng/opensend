import { type SQL, and, count, desc, eq, ilike, lt } from "drizzle-orm";
import { db } from "../client";
import { templates } from "../schema";

export const templateRepo = {
  async findById(id: string) {
    return await db.query.templates.findFirst({
      where: eq(templates.id, id),
    });
  },

  async findByAlias(alias: string) {
    return await db.query.templates.findFirst({
      where: eq(templates.alias, alias),
    });
  },

  async create(data: typeof templates.$inferInsert) {
    return await db.insert(templates).values(data).returning();
  },

  async update(id: string, data: Partial<typeof templates.$inferInsert>) {
    return await db
      .update(templates)
      .set(data)
      .where(eq(templates.id, id))
      .returning();
  },

  async delete(id: string) {
    return await db.delete(templates).where(eq(templates.id, id)).returning();
  },

  async list(
    options: {
      limit?: number;
      after?: string;
      search?: string;
      status?: string;
    } = {},
  ) {
    const { limit = 20, after, search, status } = options;
    const conditions = [];

    if (search) conditions.push(ilike(templates.name, `%${search}%`));
    if (status) conditions.push(eq(templates.status, status));
    if (after) conditions.push(lt(templates.id, after));

    const results = await db
      .select()
      .from(templates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(templates.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },

  async listForApi(
    options: {
      search?: string;
      status?: string;
    } = {},
  ) {
    const { search, status } = options;
    const conditions: SQL[] = [];

    if (search) conditions.push(ilike(templates.name, `%${search}%`));
    if (status === "published" || status === "draft") {
      conditions.push(eq(templates.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalRow] = await db
      .select({ count: count() })
      .from(templates)
      .where(whereClause);

    const data = await db
      .select({
        id: templates.id,
        name: templates.name,
        alias: templates.alias,
        status: templates.status,
        currentVersionId: templates.currentVersionId,
        publishedAt: templates.publishedAt,
        hasUnpublishedVersions: templates.hasUnpublishedVersions,
        createdAt: templates.createdAt,
      })
      .from(templates)
      .where(whereClause)
      .orderBy(desc(templates.createdAt))
      .limit(200);

    return { data, total: totalRow?.count ?? 0 };
  },
};
