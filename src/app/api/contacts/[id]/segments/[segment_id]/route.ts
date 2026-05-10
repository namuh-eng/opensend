import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { ContactServiceError, createContactService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

function contactService() {
  return createContactService();
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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

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
