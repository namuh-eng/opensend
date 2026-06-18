import {
  handleCreateAutomation,
  handleListAutomations,
} from "@/app/api/automations/handlers";
import { authorizePublicAutomationRoute } from "./auth";

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;
  return handleListAutomations(request, auth.auth);
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;
  return handleCreateAutomation(request, auth.auth);
}
