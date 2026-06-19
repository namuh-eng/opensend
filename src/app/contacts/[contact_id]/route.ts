import {
  DELETE as deleteContact,
  GET as getContact,
  PATCH as patchContact,
} from "@/app/api/contacts/[id]/route";
import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";

type ContactRouteContext = {
  params: Promise<{ contact_id: string }>;
};

async function toInternalContext(context: ContactRouteContext) {
  const { contact_id } = await context.params;
  return { params: Promise.resolve({ id: contact_id }) };
}

async function requireRootApiKey(request: Request): Promise<Response | null> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  return auth ? null : unauthorizedResponse();
}

export async function GET(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  const authError = await requireRootApiKey(request);
  if (authError) return authError;

  return getContact(request, await toInternalContext(context));
}

export async function PATCH(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  const authError = await requireRootApiKey(request);
  if (authError) return authError;

  return patchContact(request, await toInternalContext(context));
}

export async function DELETE(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  const authError = await requireRootApiKey(request);
  if (authError) return authError;

  return deleteContact(request, await toInternalContext(context));
}
