import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  EmailTraceServiceError,
  createEmailTraceService,
} from "@opensend/core";
import { type NextRequest, NextResponse } from "next/server";

const emailTraceService = createEmailTraceService();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const trace = await emailTraceService.getTrace(auth.userId, id);
    return NextResponse.json(trace);
  } catch (error) {
    if (
      error instanceof EmailTraceServiceError &&
      error.code === "email_not_found"
    ) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    console.error("Failed to fetch email trace:", error);
    return NextResponse.json(
      { error: "Failed to fetch email trace" },
      { status: 500 },
    );
  }
}
