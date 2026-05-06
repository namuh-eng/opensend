import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logs } from "@/lib/db/schema";
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

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 20, 1),
    100,
  );

  const status = url.searchParams.get("status");
  const method = url.searchParams.get("method");
  const apiKeyId =
    url.searchParams.get("api_key_id") || url.searchParams.get("apiKeyId");
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");
  const dateFrom = parseDate(
    url.searchParams.get("date_from") || url.searchParams.get("created_after"),
  );
  const dateTo = parseDate(
    url.searchParams.get("date_to") || url.searchParams.get("created_before"),
    true,
  );
  const userAgent =
    url.searchParams.get("user_agent") || url.searchParams.get("userAgent");
  const search = (
    url.searchParams.get("q") ||
    url.searchParams.get("search") ||
    ""
  ).trim();

  try {
    const conditions: SQL[] = [eq(logs.userId, auth.userId)];

    if (status) {
      conditions.push(eq(logs.status, Number(status)));
    }
    if (method) {
      conditions.push(eq(logs.method, method.toUpperCase()));
    }
    if (apiKeyId) {
      conditions.push(eq(logs.apiKeyId, apiKeyId));
    }
    if (after) {
      conditions.push(lt(logs.id, after));
    }
    if (before) {
      conditions.push(gt(logs.id, before));
    }
    if (dateFrom) {
      conditions.push(gte(logs.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(logs.createdAt, dateTo));
    }
    if (userAgent) {
      conditions.push(ilike(logs.userAgent, `%${userAgent}%`));
    }
    if (search) {
      conditions.push(
        or(
          sql`${logs.id}::text ILIKE ${`%${search}%`}`,
          ilike(logs.endpoint, `%${search}%`),
          ilike(logs.userAgent, `%${search}%`),
          sql`${logs.status}::text ILIKE ${`%${search}%`}`,
          sql`${logs.requestBody}::text ILIKE ${`%${search}%`}`,
          sql`${logs.responseBody}::text ILIKE ${`%${search}%`}`,
          sql`${logs.document}::text ILIKE ${`%${search}%`}`,
        ) as SQL,
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

    const results = await (before
      ? query.orderBy(logs.id).limit(limit + 1)
      : query.orderBy(desc(logs.id)).limit(limit + 1));

    let dataRows = results.slice(0, limit);
    if (before) {
      dataRows = dataRows.reverse();
    }
    const hasMore = results.length > limit;

    return Response.json({
      object: "list",
      data: dataRows.map((l) => ({
        id: l.id,
        method: l.method,
        endpoint: l.endpoint,
        response_status: l.status,
        user_agent: l.userAgent,
        api_key_id: l.apiKeyId,
        created_at: l.createdAt,
      })),
      has_more: hasMore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list logs";
    return Response.json({ error: message }, { status: 500 });
  }
}
