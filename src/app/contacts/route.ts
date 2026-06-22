import {
  POST as createContact,
  GET as listContacts,
} from "@/app/api/contacts/route";
import { rootApiAliasHeaderName } from "@/lib/root-api-compatibility";

function withRootAlias(request: Request): Request {
  const headers = new Headers(request.headers);
  headers.set(rootApiAliasHeaderName, "contacts");

  return new Request(request, { headers });
}

export async function GET(request: Request): Promise<Response> {
  return listContacts(withRootAlias(request) as never);
}

export async function POST(request: Request): Promise<Response> {
  return createContact(withRootAlias(request) as never);
}
