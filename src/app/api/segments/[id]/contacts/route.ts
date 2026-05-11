import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

function audienceMetadataService() {
  return createAudienceMetadataService();
}

function mapServiceError(error: unknown) {
  if (error instanceof AudienceMetadataServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Failed to fetch segment contacts:", error);
  return NextResponse.json(
    { error: "Failed to fetch segment contacts" },
    { status: 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

  try {
    const { id: segmentId } = await params;
    const url = request.nextUrl;
    const result = await audienceMetadataService().listSegmentContacts({
      userId,
      segmentId,
      limit: Number(url.searchParams.get("limit")) || undefined,
      after: url.searchParams.get("after") || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error);
  }
}
