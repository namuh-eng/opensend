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

function mapContactServiceError(error: unknown, fallback: string) {
  if (error instanceof ContactServiceError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; segment_id: string }> },
) {
  const auth = await authorizeContactSegmentRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();
  const gate = await checkMutationAllowed(userId);
  if (!gate.ok) return quotaExceededResponse(gate.info);

  try {
    const { id: idOrEmail, segment_id: segmentId } = await params;
    const result = await contactService().addContactToSegment({
      idOrEmail,
      segmentId,
      userId,
    });

    return NextResponse.json({
      object: "contact_segment",
      contact_id: result.contactId,
      segment_id: result.segmentId,
      added: true,
    });
  } catch (error) {
    return mapContactServiceError(error, "Failed to add contact to segment");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; segment_id: string }> },
) {
  const auth = await authorizeContactSegmentRequest(request);
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;
  const userId = await resolveUserId(auth);
  if (!userId) return unauthorizedResponse();
  const gate = await checkMutationAllowed(userId);
  if (!gate.ok) return quotaExceededResponse(gate.info);

  try {
    const { id: idOrEmail, segment_id: segmentId } = await params;
    const result = await contactService().removeContactFromSegment({
      idOrEmail,
      segmentId,
      userId,
    });

    return NextResponse.json({
      object: "contact_segment",
      contact_id: result.contactId,
      segment_id: result.segmentId,
      deleted: true,
    });
  } catch (error) {
    return mapContactServiceError(
      error,
      "Failed to remove contact from segment",
    );
  }
}
