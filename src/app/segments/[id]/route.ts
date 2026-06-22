import {
  DELETE as deleteSegment,
  GET as getSegment,
} from "@/app/api/segments/[id]/route";
import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import type { NextRequest } from "next/server";

type SegmentRouteContext = {
  params: Promise<{ id: string }>;
};

async function requireRootApiKey(request: Request): Promise<Response | null> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  return auth ? null : unauthorizedResponse();
}

export async function GET(
  request: NextRequest,
  context: SegmentRouteContext,
): Promise<Response> {
  const authError = await requireRootApiKey(request);
  if (authError) return authError;

  return getSegment(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: SegmentRouteContext,
): Promise<Response> {
  const authError = await requireRootApiKey(request);
  if (authError) return authError;

  return deleteSegment(request, context);
}
