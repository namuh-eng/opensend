import { cancelAutomationRunSchema } from "@/lib/validation/automations";
import {
  authorizeAutomationRunRoute,
  automationRunService,
  mapAutomationRunServiceError,
} from "../../route-helpers";

async function readJsonBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (!body.trim()) return {};
  return JSON.parse(body) as unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRunRoute(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cancelAutomationRunSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id, runId } = await params;
  try {
    const run = await automationRunService.cancelRun({
      automationId: id,
      runId,
      userId: auth.userId,
      reason: parsed.data.reason,
    });

    return Response.json(run);
  } catch (err) {
    return mapAutomationRunServiceError(err, "Failed to cancel automation run");
  }
}
