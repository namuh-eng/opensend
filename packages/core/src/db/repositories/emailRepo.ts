import {
  type SQL,
  and,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  lte,
  or,
} from "drizzle-orm";
import { db } from "../client";
import { emails } from "../schema";

export const emailRepo = {
  async findById(id: string, userId?: string | null) {
    return await db.query.emails.findFirst({
      where: userId
        ? and(eq(emails.id, id), eq(emails.userId, userId))
        : eq(emails.id, id),
    });
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.emails.findFirst({
      where: and(eq(emails.id, id), eq(emails.userId, userId)),
    });
  },

  async findByIdempotencyKey(
    key: string,
    userId?: string | null,
    options: { createdAtOrAfter?: Date } = {},
  ) {
    const conditions: SQL[] = [eq(emails.idempotencyKey, key)];
    if (userId) conditions.push(eq(emails.userId, userId));
    if (options.createdAtOrAfter) {
      conditions.push(gte(emails.createdAt, options.createdAtOrAfter));
    }

    return await db.query.emails.findFirst({
      where: and(...conditions),
    });
  },

  async expireIdempotencyKeyBefore(
    key: string,
    before: Date,
    userId?: string | null,
  ) {
    const conditions: SQL[] = [
      eq(emails.idempotencyKey, key),
      lt(emails.createdAt, before),
    ];
    if (userId) conditions.push(eq(emails.userId, userId));

    await db
      .update(emails)
      .set({ idempotencyKey: null })
      .where(and(...conditions));
  },

  async create(data: typeof emails.$inferInsert) {
    return await db.insert(emails).values(data).returning();
  },

  async update(
    id: string,
    data: Partial<typeof emails.$inferInsert>,
    userId?: string | null,
  ) {
    return await db
      .update(emails)
      .set(data)
      .where(
        userId
          ? and(eq(emails.id, id), eq(emails.userId, userId))
          : eq(emails.id, id),
      )
      .returning();
  },

  async findDueScheduled(options: { limit?: number; now?: Date } = {}) {
    const { limit = 50, now = new Date() } = options;
    return await db
      .select()
      .from(emails)
      .where(and(eq(emails.status, "scheduled"), lte(emails.scheduledAt, now)))
      .limit(limit);
  },

  async markDueScheduledQueued(id: string, options: { now?: Date } = {}) {
    const { now = new Date() } = options;
    return await db
      .update(emails)
      .set({ status: "queued" })
      .where(
        and(
          eq(emails.id, id),
          eq(emails.status, "scheduled"),
          lte(emails.scheduledAt, now),
        ),
      )
      .returning();
  },

  async findQueuedForDispatch(options: { limit?: number; now?: Date } = {}) {
    const { limit = 50, now = new Date() } = options;
    return await db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.status, "queued"),
          or(isNull(emails.scheduledAt), lte(emails.scheduledAt, now)),
          or(
            isNull(emails.providerNextRetryAt),
            lte(emails.providerNextRetryAt, now),
          ),
        ),
      )
      .orderBy(emails.createdAt)
      .limit(limit);
  },

  async claimForSending(id: string, options: { now?: Date } = {}) {
    const { now = new Date() } = options;
    return await db
      .update(emails)
      .set({ status: "processing" })
      .where(
        and(
          eq(emails.id, id),
          or(
            eq(emails.status, "queued"),
            and(eq(emails.status, "scheduled"), lte(emails.scheduledAt, now)),
          ),
          or(isNull(emails.scheduledAt), lte(emails.scheduledAt, now)),
          or(
            isNull(emails.providerNextRetryAt),
            lte(emails.providerNextRetryAt, now),
          ),
        ),
      )
      .returning();
  },

  async deleteForUser(id: string, userId: string) {
    await db
      .delete(emails)
      .where(and(eq(emails.id, id), eq(emails.userId, userId)));
  },

  async listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    before?: string;
    status?: string;
  }) {
    const conditions: SQL[] = [eq(emails.userId, options.userId)];

    if (options.status && options.status !== "all") {
      conditions.push(eq(emails.status, options.status));
    }
    if (options.after) {
      conditions.push(gt(emails.id, options.after));
    } else if (options.before) {
      conditions.push(lt(emails.id, options.before));
    }

    const results = await db
      .select({
        id: emails.id,
        from: emails.from,
        to: emails.to,
        subject: emails.subject,
        cc: emails.cc,
        bcc: emails.bcc,
        replyTo: emails.replyTo,
        status: emails.status,
        providerRetryCount: emails.providerRetryCount,
        providerLastAttemptedAt: emails.providerLastAttemptedAt,
        providerNextRetryAt: emails.providerNextRetryAt,
        providerLastErrorCode: emails.providerLastErrorCode,
        providerLastErrorMessage: emails.providerLastErrorMessage,
        providerDeadLetteredAt: emails.providerDeadLetteredAt,
        scheduledAt: emails.scheduledAt,
        sentAt: emails.sentAt,
        createdAt: emails.createdAt,
      })
      .from(emails)
      .where(and(...conditions))
      .orderBy(desc(emails.createdAt))
      .limit(options.limit + 1);

    const hasMore = results.length > options.limit;
    const data = hasMore ? results.slice(0, options.limit) : results;

    return { data, hasMore };
  },

  async list(
    options: {
      limit?: number;
      after?: string;
      before?: string;
      userId?: string;
    } = {},
  ) {
    const { limit = 20, after, before, userId } = options;

    const conditions = [];

    if (userId) conditions.push(eq(emails.userId, userId));
    if (after) conditions.push(gt(emails.id, after));
    else if (before) conditions.push(lt(emails.id, before));

    const results = await db
      .select()
      .from(emails)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emails.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },
};
