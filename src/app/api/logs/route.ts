import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logs } from "@/lib/db/schema";
import { type SQL, and, desc, eq, gt, lt } from "drizzle-orm";

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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
      .select({
        id: logs.id,
        method: logs.method,
        endpoint: logs.endpoint,
        status: logs.status,
        userAgent: logs.userAgent,
        createdAt: logs.createdAt,
      })
      .from(logs)
      .where(whereClause);

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
        created_at: l.createdAt,
      })),
      has_more: hasMore,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list logs";
    return Response.json({ error: message }, { status: 500 });
  }
}
