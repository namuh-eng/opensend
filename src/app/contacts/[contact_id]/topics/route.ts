import {
  GET as listContactTopics,
  PATCH as updateContactTopics,
} from "@/app/api/contacts/[id]/topics/route";
import type { NextRequest } from "next/server";

type ContactTopicsRouteContext = {
  params: Promise<{ contact_id: string }>;
};

async function toInternalContext(context: ContactTopicsRouteContext) {
  const { contact_id } = await context.params;
  return { params: Promise.resolve({ id: contact_id }) };
}

export async function GET(
  request: NextRequest,
  context: ContactTopicsRouteContext,
): Promise<Response> {
  return listContactTopics(request, await toInternalContext(context));
}

export async function PATCH(
  request: NextRequest,
  context: ContactTopicsRouteContext,
): Promise<Response> {
  return updateContactTopics(request, await toInternalContext(context));
}
