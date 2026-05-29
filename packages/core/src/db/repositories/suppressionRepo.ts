import {
  type SQL,
  and,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../client";
import {
  type SuppressionReason,
  type SuppressionSourceMetadata,
  emailSuppressions,
  emails,
} from "../schema";

export type SuppressionRecord = typeof emailSuppressions.$inferSelect;

export type SuppressionListFilters = {
  search?: string;
  reason?: SuppressionReason;
  source?: "manual" | "operator" | "ses";
  createdAfter?: Date;
  createdBefore?: Date;
  domain?: string;
  topicId?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const suppressionRepo = {
  async findByUserAndEmails(
    userId: string | null | undefined,
    recipients: string[],
  ) {
    if (!userId || recipients.length === 0) return [];
    const normalized = [...new Set(recipients.map(normalizeEmail))];
    return await db
      .select()
      .from(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.userId, userId),
          inArray(emailSuppressions.email, normalized),
        ),
      );
  },

  async list(options: {
    userId: string;
    limit?: number;
    after?: string;
    filters?: SuppressionListFilters;
  }) {
    const limit = options.limit ?? 50;
    const conditions: SQL[] = [eq(emailSuppressions.userId, options.userId)];
    if (options.after)
      conditions.push(sql`${emailSuppressions.id} < ${options.after}`);

    const filters = options.filters;
    const search = filters?.search?.trim();
    if (search) {
      const pattern = `%${search}%`;
      const searchCondition = or(
        sql`${emailSuppressions.id}::text ILIKE ${pattern}`,
        sql`${emailSuppressions.email} ILIKE ${pattern}`,
        sql`${emailSuppressions.sourceEmailId}::text ILIKE ${pattern}`,
        sql`${emailSuppressions.sourceMessageId} ILIKE ${pattern}`,
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (filters?.reason)
      conditions.push(eq(emailSuppressions.reason, filters.reason));
    if (filters?.source)
      conditions.push(
        sql`${emailSuppressions.metadata}->>'source' = ${filters.source}`,
      );
    if (filters?.createdAfter)
      conditions.push(
        gte(emailSuppressions.suppressedAt, filters.createdAfter),
      );
    if (filters?.createdBefore)
      conditions.push(
        lte(emailSuppressions.suppressedAt, filters.createdBefore),
      );

    const domain = filters?.domain?.trim().toLowerCase();
    if (domain) {
      const pattern = `%${domain}%`;
      conditions.push(sql`exists (
        select 1 from ${emails}
        where ${emails.id} = ${emailSuppressions.sourceEmailId}
          and ${emails.userId} = ${options.userId}
          and lower(${emails.from}) like ${pattern}
      )`);
    }

    const topicId = filters?.topicId?.trim();
    if (topicId) {
      conditions.push(sql`exists (
        select 1 from ${emails}
        where ${emails.id} = ${emailSuppressions.sourceEmailId}
          and ${emails.userId} = ${options.userId}
          and ${emails.topicId}::text = ${topicId}
      )`);
    }

    const rows = await db
      .select()
      .from(emailSuppressions)
      .where(and(...conditions))
      .orderBy(desc(emailSuppressions.updatedAt))
      .limit(limit + 1);

    return {
      data: rows.slice(0, limit),
      hasMore: rows.length > limit,
    };
  },

  async removeForUser(userId: string, email: string) {
    const normalized = normalizeEmail(email);
    return await db
      .delete(emailSuppressions)
      .where(
        and(
          eq(emailSuppressions.userId, userId),
          eq(emailSuppressions.email, normalized),
        ),
      )
      .returning({ id: emailSuppressions.id });
  },

  async suppress(input: {
    userId: string;
    email: string;
    reason: SuppressionReason;
    sourceEventId?: string | null;
    sourceEmailId?: string | null;
    sourceMessageId?: string | null;
    metadata?: SuppressionSourceMetadata | null;
  }) {
    const now = new Date();
    const [record] = await db
      .insert(emailSuppressions)
      .values({
        userId: input.userId,
        email: normalizeEmail(input.email),
        reason: input.reason,
        sourceEventId: input.sourceEventId ?? null,
        sourceEmailId: input.sourceEmailId ?? null,
        sourceMessageId: input.sourceMessageId ?? null,
        metadata: input.metadata ?? null,
        suppressedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [emailSuppressions.userId, emailSuppressions.email],
        set: {
          reason: input.reason,
          sourceEventId: input.sourceEventId ?? null,
          sourceEmailId: input.sourceEmailId ?? null,
          sourceMessageId: input.sourceMessageId ?? null,
          metadata: input.metadata ?? null,
          suppressedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    return record;
  },

  async suppressFromSesEvent(input: {
    emailId: string;
    recipients: string[];
    reason: SuppressionReason;
    sourceEventId: string;
    sourceMessageId: string;
    metadata?: SuppressionSourceMetadata | null;
  }) {
    if (input.recipients.length === 0) return [];
    const email = await db.query.emails.findFirst({
      where: eq(emails.id, input.emailId),
    });
    if (!email?.userId) return [];

    const records: SuppressionRecord[] = [];
    for (const recipient of [
      ...new Set(input.recipients.map(normalizeEmail)),
    ]) {
      const record = await this.suppress({
        userId: email.userId,
        email: recipient,
        reason: input.reason,
        sourceEventId: input.sourceEventId,
        sourceEmailId: input.emailId,
        sourceMessageId: input.sourceMessageId,
        metadata: {
          source: "ses",
          sourceEventId: input.sourceEventId,
          sourceEmailId: input.emailId,
          sourceMessageId: input.sourceMessageId,
          ...input.metadata,
        },
      });
      records.push(record);
    }
    return records;
  },
};
