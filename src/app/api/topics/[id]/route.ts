import {
  type AuthResult,
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { getRootApiAlias, isRootApiAlias } from "@/lib/root-api-compatibility";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

type RouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

// Accept either a dashboard session cookie or a full-access Bearer key so
// topic management works from the dashboard UI.
async function resolveUserId(auth: RouteAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;
  if ("dashboardUserId" in auth) return auth.dashboardUserId;
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

function inputMode(request: NextRequest) {
  const alias = getRootApiAlias(request.headers);
  return alias === "topics" ? "root" : "api";
}

async function authorizeTopicRequest(
  request: NextRequest,
): Promise<RouteAuth | AuthResult | null> {
  if (isRootApiAlias(request.headers, "topics")) {
    return validateApiKey(request.headers.get("authorization"));
  }

  return authorizeDashboardOrApiKey(request.headers.get("authorization"));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTopicRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await audienceMetadataService().getTopic({
      userId,
      id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to fetch topic");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTopicRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const result = await audienceMetadataService().updateTopic({
      userId,
      id,
      body,
      mode: inputMode(request),
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to update topic");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeTopicRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    await audienceMetadataService().deleteTopic({
      userId,
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapServiceError(error, "Failed to delete topic");
  }
}
