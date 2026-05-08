import {
  DELETE as deleteContact,
  GET as getContact,
  PATCH as patchContact,
} from "@/app/api/contacts/[id]/route";

type ContactRouteContext = {
  params: Promise<{ contact_id: string }>;
};

async function toInternalContext(context: ContactRouteContext) {
  const { contact_id } = await context.params;
  return { params: Promise.resolve({ id: contact_id }) };
}

export async function GET(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  return getContact(request, await toInternalContext(context));
}

export async function PATCH(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  return patchContact(request, await toInternalContext(context));
}

export async function DELETE(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  return deleteContact(request, await toInternalContext(context));
}
