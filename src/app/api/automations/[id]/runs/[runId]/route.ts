import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { formatRunDetail } from "@/lib/automations";
import { db } from "@/lib/db";
import { automationRuns, automations } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const { id, runId } = await params;
  try {
    const ownerConditions = [eq(automations.id, id)];
    if (auth.userId) ownerConditions.push(eq(automations.userId, auth.userId));
    const automation = await db.query.automations.findFirst({
      where: and(...ownerConditions),
    });
    if (!automation) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }

    const run = await db.query.automationRuns.findFirst({
      where: and(
        eq(automationRuns.id, runId),
        eq(automationRuns.automationId, id),
      ),
    });
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });

    return Response.json(formatRunDetail(run));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve automation run";
    return Response.json({ error: message }, { status: 500 });
  }
}
