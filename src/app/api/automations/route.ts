import { handleCreateAutomation, handleListAutomations } from "./handlers";
import { authorizeAutomationRoute } from "./route-helpers";

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeAutomationRoute(request);
  if ("response" in auth) return auth.response;

  return handleCreateAutomation(request, auth);
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeAutomationRoute(request);
  if ("response" in auth) return auth.response;

  return handleListAutomations(request, auth);
}
