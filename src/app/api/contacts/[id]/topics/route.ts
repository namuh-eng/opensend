import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  ContactOperationsServiceError,
  createContactOperationsService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

function contactOperationsService() {
  return createContactOperationsService();
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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

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
