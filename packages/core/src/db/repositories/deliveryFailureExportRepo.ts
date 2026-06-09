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
  emailEvents,
  emailSuppressions,
  emails,
} from "../schema";

export type DeliveryFailureEmailStatus = "bounced" | "complained";

export type DeliveryFailureEmailRow = {
  id: string;
  to: string[];
  status: DeliveryFailureEmailStatus;
  providerLastErrorMessage: string | null;
  providerLastErrorCode: string | null;
  providerLastAttemptedAt: Date | null;
  createdAt: Date;
};

export type DeliveryFailureEventRow = {
  emailId: string | null;
  sourceId: string | null;
  type: string;
  payload: unknown;
  receivedAt: Date;
};

export type DeliveryFailureSuppressionRow = {
  id: string;
  email: string;
  reason: SuppressionReason;
  sourceEmailId: string | null;
  sourceMessageId: string | null;
  suppressedAt: Date;
  updatedAt: Date;
};

export type DeliveryFailureExportRepository = {
  listEmailFailures(options: {
    userId: string;
    statuses: DeliveryFailureEmailStatus[];
    start?: Date;
    end?: Date;
    search?: string;
    limit: number;
  }): Promise<DeliveryFailureEmailRow[]>;
  listEventsForEmails(options: {
    userId: string;
    emailIds: string[];
    statuses: DeliveryFailureEmailStatus[];
  }): Promise<DeliveryFailureEventRow[]>;
  listSuppressionFailures(options: {
    userId: string;
    start?: Date;
    end?: Date;
    search?: string;
    limit: number;
  }): Promise<DeliveryFailureSuppressionRow[]>;
};

function searchPattern(search: string | undefined): string | null {
  const trimmed = search?.trim();
  return trimmed ? `%${trimmed}%` : null;
}

export const deliveryFailureExportRepo: DeliveryFailureExportRepository = {
  async listEmailFailures(options) {
    if (options.statuses.length === 0) return [];

    const conditions: SQL[] = [
      eq(emails.userId, options.userId),
      inArray(emails.status, options.statuses),
    ];

    if (options.start) conditions.push(gte(emails.createdAt, options.start));
    if (options.end) conditions.push(lte(emails.createdAt, options.end));

    const pattern = searchPattern(options.search);
    if (pattern) {
      const searchCondition = or(
        sql`${emails.id}::text ilike ${pattern}`,
        sql`${emails.to}::text ilike ${pattern}`,
        sql`${emails.subject} ilike ${pattern}`,
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const rows = await db
      .select({
        id: emails.id,
        to: emails.to,
        status: emails.status,
        providerLastErrorMessage: emails.providerLastErrorMessage,
        providerLastErrorCode: emails.providerLastErrorCode,
        providerLastAttemptedAt: emails.providerLastAttemptedAt,
        createdAt: emails.createdAt,
      })
      .from(emails)
      .where(and(...conditions))
      .orderBy(desc(emails.createdAt))
      .limit(options.limit);

    return rows.map((row) => ({
      ...row,
      status: row.status as DeliveryFailureEmailStatus,
    }));
  },

  async listEventsForEmails(options) {
    if (options.emailIds.length === 0 || options.statuses.length === 0) {
      return [];
    }

    return await db
      .select({
        emailId: emailEvents.emailId,
        sourceId: emailEvents.sourceId,
        type: emailEvents.type,
        payload: emailEvents.payload,
        receivedAt: emailEvents.receivedAt,
      })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.userId, options.userId),
          inArray(emailEvents.emailId, options.emailIds),
          inArray(emailEvents.type, options.statuses),
        ),
      )
      .orderBy(desc(emailEvents.receivedAt));
  },

  async listSuppressionFailures(options) {
    const conditions: SQL[] = [eq(emailSuppressions.userId, options.userId)];

    if (options.start) {
      conditions.push(gte(emailSuppressions.suppressedAt, options.start));
    }
    if (options.end) {
      conditions.push(lte(emailSuppressions.suppressedAt, options.end));
    }

    const pattern = searchPattern(options.search);
    if (pattern) {
      const searchCondition = or(
        sql`${emailSuppressions.id}::text ilike ${pattern}`,
        sql`${emailSuppressions.email} ilike ${pattern}`,
        sql`${emailSuppressions.sourceEmailId}::text ilike ${pattern}`,
        sql`${emailSuppressions.sourceMessageId} ilike ${pattern}`,
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    return await db
      .select({
        id: emailSuppressions.id,
        email: emailSuppressions.email,
        reason: emailSuppressions.reason,
        sourceEmailId: emailSuppressions.sourceEmailId,
        sourceMessageId: emailSuppressions.sourceMessageId,
        suppressedAt: emailSuppressions.suppressedAt,
        updatedAt: emailSuppressions.updatedAt,
      })
      .from(emailSuppressions)
      .where(and(...conditions))
      .orderBy(desc(emailSuppressions.suppressedAt))
      .limit(options.limit);
  },
};
