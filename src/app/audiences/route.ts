import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { NextResponse } from "next/server";

type AudienceRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

type SegmentListResult = Awaited<
  ReturnType<ReturnType<typeof createAudienceMetadataService>["listSegments"]>
>;

type SegmentCreateResult = Awaited<
  ReturnType<ReturnType<typeof createAudienceMetadataService>["createSegment"]>
>;

async function resolveUserId(auth: AudienceRouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
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
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const result = await audienceMetadataService().listSegments({
      userId,
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
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const body = await request.json();
    const result = await audienceMetadataService().createSegment({
      userId,
      body,
    });

    return NextResponse.json(toAudienceCreateResponse(result), { status: 201 });
  } catch (error) {
    return mapServiceError(error, "Failed to create audience");
  }
}
