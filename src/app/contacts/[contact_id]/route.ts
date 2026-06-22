import {
  DELETE as deleteContact,
  GET as getContact,
  PATCH as patchContact,
} from "@/app/api/contacts/[id]/route";
import { rootApiAliasHeaderName } from "@/lib/root-api-compatibility";

type ContactRouteContext = {
  params: Promise<{ contact_id: string }>;
};

async function toInternalContext(context: ContactRouteContext) {
  const { contact_id } = await context.params;
  return { params: Promise.resolve({ id: contact_id }) };
}

function withRootAlias(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set(rootApiAliasHeaderName, "contacts");

  return new Request(request, { headers });
}

export async function GET(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  return getContact(withRootAlias(request), await toInternalContext(context));
}

export async function PATCH(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  return patchContact(withRootAlias(request), await toInternalContext(context));
}

export async function DELETE(
  request: Request,
  context: ContactRouteContext,
): Promise<Response> {
  return deleteContact(
    withRootAlias(request),
    await toInternalContext(context),
  );
}
