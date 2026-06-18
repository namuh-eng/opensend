import { handleStopAutomation } from "@/app/api/automations/handlers";
import { authorizePublicAutomationRoute } from "../../auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  return handleStopAutomation(auth.auth, id);
}
