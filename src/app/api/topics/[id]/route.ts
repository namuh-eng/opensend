import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { getRootApiAlias } from "@/lib/root-api-compatibility";
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

function inputMode(request: NextRequest) {
  const alias = getRootApiAlias(request.headers);
  return alias === "topics" ? "root" : "api";
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
    const result = await audienceMetadataService().getTopic({
      userId: auth.userId,
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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const result = await audienceMetadataService().updateTopic({
      userId: auth.userId,
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
    await audienceMetadataService().deleteTopic({
      userId: auth.userId,
      id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapServiceError(error, "Failed to delete topic");
  }
}
