import { handleGetAutomationRun } from "@/app/api/automations/handlers";
import { authorizePublicAutomationRoute } from "../../../auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;

  const { id, runId } = await params;
  return handleGetAutomationRun(auth.auth, id, runId);
}
