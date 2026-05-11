import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { NextResponse } from "next/server";

type SegmentDetailResult = Awaited<
  ReturnType<ReturnType<typeof createAudienceMetadataService>["getSegment"]>
>;

type AudienceRouteContext = {
  params: Promise<{ audience_id: string }>;
};

function audienceMetadataService() {
  return createAudienceMetadataService();
}

function mapServiceError(error: unknown, fallback: string) {
  if (error instanceof AudienceMetadataServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error(`${fallback}:`, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function toAudienceDetailResponse(result: SegmentDetailResult) {
  return {
    object: "audience" as const,
    id: result.id,
    name: result.name,
    created_at: result.created_at,
  };
}

export async function GET(request: Request, context: AudienceRouteContext) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  try {
    const { audience_id } = await context.params;
    const result = await audienceMetadataService().getSegment({
      userId: auth.userId,
      id: audience_id,
    });

    return NextResponse.json(toAudienceDetailResponse(result));
  } catch (error) {
    return mapServiceError(error, "Failed to fetch audience");
  }
}

export async function DELETE(request: Request, context: AudienceRouteContext) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  try {
    const { audience_id } = await context.params;
    await audienceMetadataService().deleteSegment({
      userId: auth.userId,
      id: audience_id,
    });

    return NextResponse.json({
      object: "audience",
      id: audience_id,
      deleted: true,
    });
  } catch (error) {
    return mapServiceError(error, "Failed to delete audience");
  }
}
