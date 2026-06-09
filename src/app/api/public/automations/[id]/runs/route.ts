import { handleListAutomationRuns } from "@/app/api/automations/handlers";
import { authorizePublicAutomationRoute } from "../../auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  return handleListAutomationRuns(request, auth.auth, id);
}
