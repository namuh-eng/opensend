import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { logs } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    const log = await db.query.logs.findFirst({
      where: and(eq(logs.id, id), eq(logs.userId, auth.userId)),
    });

    if (!log) {
      return Response.json({ error: "Log not found" }, { status: 404 });
    }

    return Response.json({
      object: "log",
      id: log.id,
      method: log.method,
      endpoint: log.endpoint,
      status: log.status,
      user_agent: log.userAgent,
      api_key_id: log.apiKeyId,
      request_body: log.requestBody,
      response_body: log.responseBody,
      created_at: log.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve log";
    return Response.json({ error: message }, { status: 500 });
  }
}
