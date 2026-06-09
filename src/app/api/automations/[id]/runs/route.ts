import { handleListAutomationRuns } from "../../handlers";
import { authorizeAutomationRunRoute } from "./route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRunRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return handleListAutomationRuns(request, auth, id);
}
