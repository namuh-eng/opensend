import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  EmailLifecycleServiceError,
  createEmailLifecycleService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

const emailLifecycleService = createEmailLifecycleService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const auth = await validateApiKey(_request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id, attachmentId } = await params;
    const result = await emailLifecycleService.getAttachment(
      auth.userId,
      id,
      attachmentId,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof EmailLifecycleServiceError &&
      error.code === "email_not_found"
    ) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    if (
      error instanceof EmailLifecycleServiceError &&
      error.code === "attachment_not_found"
    ) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 },
      );
    }

    console.error("Failed to fetch email attachment:", error);
    return NextResponse.json(
      { error: "Failed to fetch email attachment" },
      { status: 500 },
    );
  }
}
