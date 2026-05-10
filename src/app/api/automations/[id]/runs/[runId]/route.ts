import {
  authorizeAutomationRunRoute,
  automationRunService,
  mapAutomationRunServiceError,
} from "../route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRunRoute(request);
  if ("response" in auth) return auth.response;

  const { id, runId } = await params;
  try {
    const run = await automationRunService.getRun({
      automationId: id,
      runId,
      userId: auth.userId,
    });
    return Response.json(run);
  } catch (err) {
    return mapAutomationRunServiceError(
      err,
      "Failed to retrieve automation run",
    );
  }
}
