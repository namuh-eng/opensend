import {
  handleDeleteAutomation,
  handleGetAutomation,
  handleUpdateAutomation,
} from "../handlers";
import { authorizeAutomationRoute } from "../route-helpers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return handleGetAutomation(auth, id);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return handleUpdateAutomation(request, auth, id);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeAutomationRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  return handleDeleteAutomation(auth, id);
}
