import {
  type SQL,
  and,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../client";
import { contacts, contactsToSegments, segments, topics } from "../schema";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const contactRepo = {
  async findById(id: string) {
    return await db.query.contacts.findFirst({
      where: eq(contacts.id, id),
    });
  },

  async findByEmail(email: string) {
    return await db.query.contacts.findFirst({
      where: eq(contacts.email, email.toLowerCase().trim()),
    });
  },

  async findByIdOrEmail(idOrEmail: string) {
    return await db.query.contacts.findFirst({
      where: or(eq(contacts.id, idOrEmail), eq(contacts.email, idOrEmail)),
    });
  },

  async findByIdOrEmailForUser(idOrEmail: string, userId: string) {
    return await db.query.contacts.findFirst({
      where: and(
        isUuid(idOrEmail)
          ? or(eq(contacts.id, idOrEmail), eq(contacts.email, idOrEmail))
          : eq(contacts.email, idOrEmail),
        eq(contacts.userId, userId),
      ),
    });
  },

  async create(data: typeof contacts.$inferInsert) {
    return await db.insert(contacts).values(data).returning();
  },

  async update(id: string, data: Partial<typeof contacts.$inferInsert>) {
    return await db
      .update(contacts)
      .set(data)
      .where(eq(contacts.id, id))
      .returning();
  },

  async updateForUser(
    id: string,
    userId: string,
    data: Record<string, unknown>,
  ) {
    return await db
      .update(contacts)
      .set(data as Partial<typeof contacts.$inferInsert>)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning();
  },

  async delete(id: string) {
    return await db
      .delete(contacts)
      .where(eq(contacts.id, id))
      .returning({ id: contacts.id });
  },

  async deleteForUser(id: string, userId: string) {
    return await db
      .delete(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
      .returning({ id: contacts.id, email: contacts.email });
  },

  async list(options: { limit?: number; after?: string; where?: SQL } = {}) {
    const { limit = 40, after, where } = options;
    const conditions = [];
    if (where) conditions.push(where);
    if (after) conditions.push(lt(contacts.id, after));

    const results = await db
      .select()
      .from(contacts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(contacts.id))
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
    status?: string;
    segmentName?: string;
  }) {
    const conditions: SQL[] = [eq(contacts.userId, options.userId)];

    if (options.search) {
      conditions.push(
        or(
          ilike(contacts.email, `%${options.search}%`),
          ilike(contacts.firstName, `%${options.search}%`),
          ilike(contacts.lastName, `%${options.search}%`),
        ) as SQL,
      );
    }

    if (options.status === "subscribed") {
      conditions.push(eq(contacts.unsubscribed, false));
    } else if (options.status === "unsubscribed") {
      conditions.push(eq(contacts.unsubscribed, true));
    }

    if (options.segmentName) {
      conditions.push(sql`${contacts.segments} ? ${options.segmentName}`);
    }

    if (options.after) {
      conditions.push(lt(contacts.id, options.after));
    }

    const rows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        unsubscribed: contacts.unsubscribed,
        segments: contacts.segments,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .where(and(...conditions))
      .orderBy(desc(contacts.id))
      .limit(options.limit + 1);

    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;

    return { data, hasMore };
  },

  async findSegmentByIdForUser(segmentId: string, userId: string) {
    return await db.query.segments.findFirst({
      where: and(eq(segments.id, segmentId), eq(segments.userId, userId)),
    });
  },

  async findSegmentByIdOrNameForUser(idOrName: string, userId: string) {
    return await db.query.segments.findFirst({
      where: and(
        or(eq(segments.id, idOrName), eq(segments.name, idOrName)),
        eq(segments.userId, userId),
      ),
    });
  },

  async findSegmentsByNamesForUser(names: string[], userId: string) {
    if (names.length === 0) return [];

    return await db
      .select({
        id: segments.id,
        name: segments.name,
        createdAt: segments.createdAt,
      })
      .from(segments)
      .where(and(inArray(segments.name, names), eq(segments.userId, userId)));
  },

  async findTopicByIdForUser(topicId: string, userId: string) {
    return await db.query.topics.findFirst({
      where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
    });
  },

  async addContactToSegment(contactId: string, segmentId: string) {
    await db
      .insert(contactsToSegments)
      .values({ contactId, segmentId })
      .onConflictDoNothing();
  },

  async removeContactFromSegment(contactId: string, segmentId: string) {
    await db
      .delete(contactsToSegments)
      .where(
        and(
          eq(contactsToSegments.contactId, contactId),
          eq(contactsToSegments.segmentId, segmentId),
        ),
      );
  },
};
