import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { ContactServiceError, createContactService } from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

function contactService() {
  return createContactService();
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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;
  if (!auth.userId) return unauthorizedResponse();
  const userId = auth.userId;

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
