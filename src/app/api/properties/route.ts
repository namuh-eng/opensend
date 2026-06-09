import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { getRootApiAlias } from "@/lib/root-api-compatibility";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

type PropertyRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

function inputMode(request: NextRequest) {
  const alias = getRootApiAlias(request.headers);
  return alias === "contact-properties" ? "root" : "api";
}

async function resolveUserId(auth: PropertyRouteAuth): Promise<string | null> {
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

export async function GET(request: NextRequest) {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const url = request.nextUrl;
    const result = await audienceMetadataService().listProperties({
      userId,
      page: Number(url.searchParams.get("page")) || undefined,
      limit: Number(url.searchParams.get("limit")) || undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to fetch contact properties");
  }
}

export async function POST(request: NextRequest) {
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
    const result = await audienceMetadataService().createProperty({
      userId,
      body,
      mode: inputMode(request),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return mapServiceError(error, "Failed to create contact property");
  }
}
