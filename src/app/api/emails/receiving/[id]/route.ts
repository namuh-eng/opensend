import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  ReceivedEmailServiceError,
  createReceivedEmailService,
} from "@opensend/core";

const receivedEmailService = createReceivedEmailService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  try {
    const { id } = await params;
    const result = await receivedEmailService.getReceivedEmail(id, auth.userId);
    return Response.json(result);
  } catch (error) {
    if (
      error instanceof ReceivedEmailServiceError &&
      error.code === "received_email_not_found"
    ) {
      return Response.json(
        { error: "Received email not found" },
        { status: 404 },
      );
    }

    console.error("Failed to fetch received email:", error);
    return Response.json(
      { error: "Failed to fetch received email" },
      { status: 500 },
    );
  }
}
