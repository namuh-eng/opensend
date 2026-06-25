import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { ContactServiceError, createContactService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

type ContactSegmentAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

function contactService() {
  return createContactService();
}

async function authorizeContactSegmentRequest(
  request: NextRequest,
): Promise<ContactSegmentAuth | null> {
  const authHeader = request.headers.get("authorization");
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return await authorizeDashboardOrApiKey(authHeader);
  }
  return await validateApiKey(authHeader);
}

async function resolveUserId(auth: ContactSegmentAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

function mapContactServiceError(error: unknown) {
  if (error instanceof ContactServiceError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  console.error("Failed to fetch contact segments:", error);
  return NextResponse.json(
    { error: "Failed to fetch contact segments" },
    { status: 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeContactSegmentRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: idOrEmail } = await params;
    const data = await contactService().listContactSegments(idOrEmail, userId);

    return NextResponse.json({
      object: "list",
      data,
      has_more: false,
    });
  } catch (error) {
    return mapContactServiceError(error);
  }
}
