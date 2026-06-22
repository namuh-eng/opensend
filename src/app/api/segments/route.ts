import {
  type AuthResult,
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { getRootApiAlias } from "@/lib/root-api-compatibility";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

type SegmentRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function resolveUserId(auth: SegmentRouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;
  if ("dashboardUserId" in auth) return auth.dashboardUserId;

  const session = await getServerSession();
  return session?.user?.id ?? null;
}

async function authorizeSegmentRequest(
  request: NextRequest,
): Promise<SegmentRouteAuth | AuthResult | null> {
  const alias = getRootApiAlias(request.headers);
  if (alias === "segments" || alias === "audiences") {
    return validateApiKey(request.headers.get("authorization"));
  }

  return authorizeDashboardOrApiKey(request.headers.get("authorization"));
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

export async function GET(request: NextRequest) {
  const auth = await authorizeSegmentRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const url = request.nextUrl;
    const result = await audienceMetadataService().listSegments({
      userId,
      limit: Number(url.searchParams.get("limit")) || undefined,
      search: url.searchParams.get("search") || undefined,
      after: url.searchParams.get("after") || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to fetch segments");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeSegmentRequest(request);
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapServiceError(error, "Failed to create segment");
  }
}
