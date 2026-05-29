import {
  type SQL,
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../client";
import { emails, logs } from "../schema";

export const logRepo = {
  async findById(id: string) {
    return await db.query.logs.findFirst({
      where: eq(logs.id, id),
    });
  },

  async findByIdForUser(id: string, userId: string) {
    return await db.query.logs.findFirst({
      where: and(eq(logs.id, id), eq(logs.userId, userId)),
    });
  },

  async create(data: typeof logs.$inferInsert) {
    return await db.insert(logs).values(data).returning();
  },

  async list(
    options: {
      limit?: number;
      after?: string;
      status?: number;
      method?: string;
    } = {},
  ) {
    const { limit = 20, after, status, method } = options;
    const conditions = [];

    if (status) conditions.push(eq(logs.status, status));
    if (method) conditions.push(eq(logs.method, method));
    if (after) conditions.push(lt(logs.id, after));

    const results = await db
      .select()
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(logs.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;

    return { data, hasMore };
  },

  async listForApi(options: {
    userId: string;
    limit: number;
    status?: number;
    method?: string;
    apiKeyId?: string;
    after?: string;
    before?: string;
    dateFrom?: Date;
    dateTo?: Date;
    userAgent?: string;
    search?: string;
    tagName?: string;
    tagValue?: string;
  }) {
    const conditions: SQL[] = [eq(logs.userId, options.userId)];

    if (options.status !== undefined) {
      conditions.push(eq(logs.status, options.status));
    }
    if (options.method) {
      conditions.push(eq(logs.method, options.method));
    }
    if (options.apiKeyId) {
      conditions.push(eq(logs.apiKeyId, options.apiKeyId));
    }
    if (options.after) {
      conditions.push(lt(logs.id, options.after));
    }
    if (options.before) {
      conditions.push(gt(logs.id, options.before));
    }
    if (options.dateFrom) {
      conditions.push(gte(logs.createdAt, options.dateFrom));
    }
    if (options.dateTo) {
      conditions.push(lte(logs.createdAt, options.dateTo));
    }
    if (options.userAgent) {
      conditions.push(ilike(logs.userAgent, `%${options.userAgent}%`));
    }
    if (options.search) {
      conditions.push(
        or(
          sql`${logs.id}::text ILIKE ${`%${options.search}%`}`,
          ilike(logs.endpoint, `%${options.search}%`),
          ilike(logs.userAgent, `%${options.search}%`),
          sql`${logs.status}::text ILIKE ${`%${options.search}%`}`,
          sql`${logs.requestBody}::text ILIKE ${`%${options.search}%`}`,
          sql`${logs.responseBody}::text ILIKE ${`%${options.search}%`}`,
          sql`${logs.document}::text ILIKE ${`%${options.search}%`}`,
        ) as SQL,
      );
    }
    if (options.tagName) {
      const tagPredicate = JSON.stringify(
        options.tagValue === undefined
          ? [{ name: options.tagName }]
          : [{ name: options.tagName, value: options.tagValue }],
      );
      conditions.push(
        sql`exists (
          select 1 from ${emails}
          where ${emails.userId} = ${options.userId}
            and ${emails.userId} = ${logs.userId}
            and (
              ${emails.id}::text = ${logs.document}->>'emailId'
              or coalesce(${logs.document}->'emailIds', '[]'::jsonb) ? ${emails.id}::text
            )
            and ${emails.tags} @> ${tagPredicate}::jsonb
        )`,
      );
    }

    const query = db
      .select({
        id: logs.id,
        method: logs.method,
        endpoint: logs.endpoint,
        status: logs.status,
        userAgent: logs.userAgent,
        apiKeyId: logs.apiKeyId,
        createdAt: logs.createdAt,
      })
      .from(logs)
      .where(and(...conditions));

    const results = await (options.before
      ? query.orderBy(logs.id).limit(options.limit + 1)
      : query.orderBy(desc(logs.id)).limit(options.limit + 1));

    let data = results.slice(0, options.limit);
    if (options.before) {
      data = data.reverse();
    }
    const hasMore = results.length > options.limit;

    return { data, hasMore };
  },
};
