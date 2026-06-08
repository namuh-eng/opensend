import {
  handleDeleteAutomation,
  handleGetAutomation,
  handleUpdateAutomation,
} from "@/app/api/automations/handlers";
import { authorizePublicAutomationRoute } from "../auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  return handleGetAutomation(auth.auth, id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  return handleUpdateAutomation(request, auth.auth, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizePublicAutomationRoute(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  return handleDeleteAutomation(auth.auth, id);
}
