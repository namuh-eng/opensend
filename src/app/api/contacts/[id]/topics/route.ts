import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import {
  checkMutationAllowed,
  quotaExceededResponse,
} from "@/lib/billing/quota";
import {
  ContactOperationsServiceError,
  createContactOperationsService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

type ContactTopicsAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

function contactOperationsService() {
  return createContactOperationsService();
}

async function authorizeContactTopicsRequest(
  request: NextRequest,
): Promise<ContactTopicsAuth | null> {
  const authHeader = request.headers.get("authorization");
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return await authorizeDashboardOrApiKey(authHeader);
  }
  return await validateApiKey(authHeader);
}

async function resolveUserId(auth: ContactTopicsAuth): Promise<string | null> {
  if ("userId" in auth) return auth.userId;
  const session = await getServerSession();
  return session?.user?.id ?? null;
}

function mapFetchContactTopicsError(error: unknown) {
  if (error instanceof ContactOperationsServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Failed to fetch contact topics:", error);
  return NextResponse.json(
    { error: "Failed to fetch contact topics" },
    { status: 500 },
  );
}

function mapUpdateContactTopicsError(error: unknown) {
  if (error instanceof ContactOperationsServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Failed to update contact topics:", error);
  return NextResponse.json(
    { error: "Failed to update contact topics" },
    { status: 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeContactTopicsRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();

  try {
    const { id: idOrEmail } = await params;
    const result = await contactOperationsService().listContactTopics({
      idOrEmail,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapFetchContactTopicsError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeContactTopicsRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();
  const gate = await checkMutationAllowed(userId);
  if (!gate.ok) return quotaExceededResponse(gate.info);

  try {
    const { id: idOrEmail } = await params;
    const result = await contactOperationsService().updateContactTopics({
      idOrEmail,
      userId,
      body: () => request.json(),
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapUpdateContactTopicsError(error);
  }
}
