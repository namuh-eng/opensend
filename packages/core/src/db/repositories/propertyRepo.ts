import { type SQL, and, asc, count, eq, ilike, or } from "drizzle-orm";
import { db } from "../client";
import { contactProperties } from "../schema";

export const propertyRepo = {
  async findById(id: string) {
    return await db.query.contactProperties.findFirst({
      where: eq(contactProperties.id, id),
    });
  },

  async create(data: typeof contactProperties.$inferInsert) {
    return await db.insert(contactProperties).values(data).returning();
  },

  async update(
    id: string,
    data: Partial<typeof contactProperties.$inferInsert>,
  ) {
    return await db
      .update(contactProperties)
      .set(data)
      .where(eq(contactProperties.id, id))
      .returning();
  },

  async delete(id: string) {
    return await db
      .delete(contactProperties)
      .where(eq(contactProperties.id, id))
      .returning();
  },

  async listForApi(options: {
    userId: string;
    page: number;
    limit: number;
    search?: string;
    type?: string;
  }) {
    const conditions: SQL[] = [eq(contactProperties.userId, options.userId)];
    if (options.search) {
      const pattern = `%${options.search}%`;
      const searchClause = or(
        ilike(contactProperties.key, pattern),
        ilike(contactProperties.name, pattern),
      );
      if (searchClause) conditions.push(searchClause);
    }
    if (options.type) {
      conditions.push(eq(contactProperties.type, options.type));
    }
    const whereClause = and(...conditions);
    const offset = (options.page - 1) * options.limit;

    const [totalRow] = await db
      .select({ count: count() })
      .from(contactProperties)
      .where(whereClause);

    const data = await db
      .select({
        id: contactProperties.id,
        key: contactProperties.key,
        name: contactProperties.name,
        type: contactProperties.type,
        fallbackValue: contactProperties.fallbackValue,
        createdAt: contactProperties.createdAt,
        updatedAt: contactProperties.updatedAt,
      })
      .from(contactProperties)
      .where(whereClause)
      .orderBy(asc(contactProperties.key))
      .limit(options.limit)
      .offset(offset);

    return { data, total: Number(totalRow?.count ?? 0) };
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.contactProperties.findFirst({
      where: and(
        eq(contactProperties.id, id),
        eq(contactProperties.userId, userId),
      ),
    });
  },

  async updateForUser(
    id: string,
    userId: string,
    data: Partial<typeof contactProperties.$inferInsert>,
  ) {
    return await db
      .update(contactProperties)
      .set(data)
      .where(
        and(eq(contactProperties.id, id), eq(contactProperties.userId, userId)),
      )
      .returning();
  },

  async deleteForUser(id: string, userId: string) {
    return await db
      .delete(contactProperties)
      .where(
        and(eq(contactProperties.id, id), eq(contactProperties.userId, userId)),
      )
      .returning();
  },
};
