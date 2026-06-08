import { GET as listContactSegments } from "@/app/api/contacts/[id]/segments/route";
import type { NextRequest } from "next/server";

type ContactRelationshipRouteContext = {
  params: Promise<{ contact_id: string }>;
};

async function toInternalContext(context: ContactRelationshipRouteContext) {
  const { contact_id } = await context.params;
  return { params: Promise.resolve({ id: contact_id }) };
}

export async function GET(
  request: NextRequest,
  context: ContactRelationshipRouteContext,
): Promise<Response> {
  return listContactSegments(request, await toInternalContext(context));
}
