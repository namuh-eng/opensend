import {
  POST as addContactToSegment,
  DELETE as removeContactFromSegment,
} from "@/app/api/contacts/[id]/segments/[segment_id]/route";
import type { NextRequest } from "next/server";

type ContactSegmentRouteContext = {
  params: Promise<{ contact_id: string; segment_id: string }>;
};

async function toInternalContext(context: ContactSegmentRouteContext) {
  const { contact_id, segment_id } = await context.params;
  return { params: Promise.resolve({ id: contact_id, segment_id }) };
}

export async function POST(
  request: NextRequest,
  context: ContactSegmentRouteContext,
): Promise<Response> {
  return addContactToSegment(request, await toInternalContext(context));
}

export async function DELETE(
  request: NextRequest,
  context: ContactSegmentRouteContext,
): Promise<Response> {
  return removeContactFromSegment(request, await toInternalContext(context));
}
