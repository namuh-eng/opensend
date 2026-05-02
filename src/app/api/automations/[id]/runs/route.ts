import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { formatRunListItem, parseRunStatusFilter } from "@/lib/automations";
import { db } from "@/lib/db";
import { automationRuns, automations } from "@/lib/db/schema";
import { listRunsQuerySchema } from "@/lib/validation/automations";
import { type SQL, and, desc, eq, inArray, lt } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  const url = new URL(request.url);
  const parsed = listRunsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    after: url.searchParams.get("after") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = await params;
  try {
    const ownerConditions = [eq(automations.id, id)];
    if (auth.userId) ownerConditions.push(eq(automations.userId, auth.userId));
    const automation = await db.query.automations.findFirst({
      where: and(...ownerConditions),
    });
    if (!automation) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }

    const conditions: SQL[] = [eq(automationRuns.automationId, automation.id)];
    const statuses = parseRunStatusFilter(parsed.data.status ?? null);
    if (statuses.length === 1) {
      conditions.push(eq(automationRuns.status, statuses[0]));
    } else if (statuses.length > 1) {
      conditions.push(inArray(automationRuns.status, statuses));
    }
    if (parsed.data.after)
      conditions.push(lt(automationRuns.id, parsed.data.after));

    const limit = parsed.data.limit ?? 25;
    const rows = await db
      .select()
      .from(automationRuns)
      .where(and(...conditions))
      .orderBy(desc(automationRuns.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return Response.json({
      object: "list",
      data: data.map(formatRunListItem),
      has_more: hasMore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list automation runs";
    return Response.json({ error: message }, { status: 500 });
  }
}
