import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { formatRunMetrics } from "@/lib/automations";
import { db } from "@/lib/db";
import { automationRuns, automations } from "@/lib/db/schema";
import { automationRunMetricsQuerySchema } from "@/lib/validation/automations";
import { type SQL, and, eq, gte, lte } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const parsed = automationRunMetricsQuerySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
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

    const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
    const to = parsed.data.to ? new Date(parsed.data.to) : undefined;
    const conditions: SQL[] = [eq(automationRuns.automationId, automation.id)];
    if (from) conditions.push(gte(automationRuns.createdAt, from));
    if (to) conditions.push(lte(automationRuns.createdAt, to));

    const runs = await db
      .select()
      .from(automationRuns)
      .where(and(...conditions));

    return Response.json(formatRunMetrics(automation.id, runs, { from, to }));
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to retrieve automation run metrics";
    return Response.json({ error: message }, { status: 500 });
  }
}
