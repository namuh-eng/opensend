import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

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
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await audienceMetadataService().getProperty({
      userId: auth.userId,
      id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to fetch contact property");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const result = await audienceMetadataService().updateProperty({
      userId: auth.userId,
      id,
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapServiceError(error, "Failed to update contact property");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    await audienceMetadataService().deleteProperty({
      userId: auth.userId,
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapServiceError(error, "Failed to delete contact property");
  }
}
