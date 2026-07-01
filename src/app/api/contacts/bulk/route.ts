import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  checkMutationAllowed,
  quotaExceededResponse,
} from "@/lib/billing/quota";
import {
  ContactOperationsServiceError,
  createContactOperationsService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

function contactOperationsService() {
  return createContactOperationsService();
}

function mapContactOperationsError(error: unknown) {
  if (error instanceof ContactOperationsServiceError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Failed bulk action:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;
  const gate = await checkMutationAllowed(userId);
  if (!gate.ok) return quotaExceededResponse(gate.info);

  try {
    const body = await request.json();
    const result = await contactOperationsService().bulkAction({
      userId,
      body,
    });

    return NextResponse.json(result);
  } catch (error) {
    return mapContactOperationsError(error);
  }
}
