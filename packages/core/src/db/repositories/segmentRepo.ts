import { type SQL, and, count, desc, eq, ilike, lt, sql } from "drizzle-orm";
import { db } from "../client";
import { contacts, contactsToSegments, segments } from "../schema";

export const segmentRepo = {
  async findById(id: string) {
    return await db.query.segments.findFirst({
      where: eq(segments.id, id),
    });
  },

  async findByName(name: string) {
    return await db.query.segments.findFirst({
      where: eq(segments.name, name),
    });
  },

  async create(data: typeof segments.$inferInsert) {
    return await db.insert(segments).values(data).returning();
  },

  async delete(id: string) {
    return await db.delete(segments).where(eq(segments.id, id)).returning();
  },

  async list(
    options: { limit?: number; after?: string; search?: string } = {},
  ) {
    const { limit = 20, after, search } = options;
    const conditions: SQL[] = [];

    if (search) conditions.push(ilike(segments.name, `%${search}%`));
    if (after) conditions.push(lt(segments.id, after));

    const results = await db
      .select()
      .from(segments)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(segments.id))
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
  }) {
    const conditions: SQL[] = [eq(segments.userId, options.userId)];

    if (options.search)
      conditions.push(ilike(segments.name, `%${options.search}%`));
    if (options.after) conditions.push(lt(segments.id, options.after));

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: segments.id,
        name: segments.name,
        createdAt: segments.createdAt,
        // Membership can come from the newer contacts_to_segments join table
        // or the persisted contacts.segments JSONB names used by existing
        // contacts. Count each tenant-owned contact once even when both
        // sources record the same membership.
        contactsCount: sql<number>`(
          select count(distinct ${contacts.id})
          from ${contacts}
          left join ${contactsToSegments}
            on ${contactsToSegments.contactId} = ${contacts.id}
            and ${contactsToSegments.segmentId} = ${segments.id}
          where ${contacts.userId} = ${options.userId}
          and (
            ${contactsToSegments.segmentId} is not null
            or coalesce(${contacts.segments}, '[]'::jsonb) ? ${segments.name}
          )
        )`.mapWith(Number),
        unsubscribedCount: sql<number>`(
          select count(distinct ${contacts.id})
          from ${contacts}
          left join ${contactsToSegments}
            on ${contactsToSegments.contactId} = ${contacts.id}
            and ${contactsToSegments.segmentId} = ${segments.id}
          where ${contacts.userId} = ${options.userId}
          and ${contacts.unsubscribed} = true
          and (
            ${contactsToSegments.segmentId} is not null
            or coalesce(${contacts.segments}, '[]'::jsonb) ? ${segments.name}
          )
        )`.mapWith(Number),
      })
      .from(segments)
      .where(whereClause)
      .orderBy(desc(segments.id))
      .limit(options.limit + 1);

    const [totalRow] = await db
      .select({ count: count() })
      .from(segments)
      .where(whereClause);

    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;

    return { data, hasMore, total: Number(totalRow?.count ?? 0) };
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.segments.findFirst({
      where: and(eq(segments.id, id), eq(segments.userId, userId)),
    });
  },

  async deleteForUser(id: string, userId: string) {
    return await db
      .delete(segments)
      .where(and(eq(segments.id, id), eq(segments.userId, userId)))
      .returning();
  },

  async listContactsForApi(options: {
    userId: string;
    segmentId: string;
    limit: number;
    after?: string;
  }) {
    const conditions: SQL[] = [
      eq(contactsToSegments.segmentId, options.segmentId),
      eq(contacts.userId, options.userId),
    ];

    if (options.after) conditions.push(lt(contacts.id, options.after));

    const rows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        unsubscribed: contacts.unsubscribed,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .innerJoin(
        contactsToSegments,
        eq(contacts.id, contactsToSegments.contactId),
      )
      .where(and(...conditions))
      .orderBy(desc(contacts.id))
      .limit(options.limit + 1);

    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;

    return { data, hasMore };
  },
};
