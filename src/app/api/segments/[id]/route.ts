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

type RouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

// Accept either a dashboard session cookie or a full-access Bearer key so
// segment management works from the dashboard UI.
async function resolveUserId(auth: RouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;
  if ("dashboardUserId" in auth) return auth.dashboardUserId;
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

async function authorizeSegmentRequest(
  request: NextRequest,
): Promise<RouteAuth | AuthResult | null> {
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeSegmentRequest(_request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await audienceMetadataService().getSegment({
      userId,
      id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to fetch segment");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeSegmentRequest(_request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    await audienceMetadataService().deleteSegment({
      userId,
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapServiceError(error, "Failed to delete segment");
  }
}
