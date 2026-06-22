import {
  type AuthResult,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { NextResponse } from "next/server";

type SegmentListResult = Awaited<
  ReturnType<ReturnType<typeof createAudienceMetadataService>["listSegments"]>
>;

type SegmentCreateResult = Awaited<
  ReturnType<ReturnType<typeof createAudienceMetadataService>["createSegment"]>
>;

async function authorizeAudienceRequest(
  request: Request,
): Promise<(AuthResult & { userId: string }) | Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  return { ...auth, userId: auth.userId };
}

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

function toAudienceListResponse(result: SegmentListResult) {
  return {
    object: "list" as const,
    has_more: result.has_more,
    data: result.data,
  };
}

function toAudienceCreateResponse(result: SegmentCreateResult) {
  return {
    object: "audience" as const,
    id: result.id,
    name: result.name,
  };
}

export async function GET(request: Request) {
  const auth = await authorizeAudienceRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(request.url);
    const result = await audienceMetadataService().listSegments({
      userId: auth.userId,
      limit: Number(url.searchParams.get("limit")) || undefined,
      search: url.searchParams.get("search") || undefined,
      after: url.searchParams.get("after") || undefined,
    });

    return NextResponse.json(toAudienceListResponse(result));
  } catch (error) {
    return mapServiceError(error, "Failed to fetch audiences");
  }
}

export async function POST(request: Request) {
  const auth = await authorizeAudienceRequest(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json();
    const result = await audienceMetadataService().createSegment({
      userId: auth.userId,
      body,
    });

    return NextResponse.json(toAudienceCreateResponse(result), { status: 201 });
  } catch (error) {
    return mapServiceError(error, "Failed to create audience");
  }
}
