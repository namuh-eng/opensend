import { handleGetAutomationRun } from "../../../handlers";
import { authorizeAutomationRunRoute } from "../route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRunRoute(request);
  if ("response" in auth) return auth.response;

  const { id, runId } = await params;
  return handleGetAutomationRun(auth, id, runId);
}
