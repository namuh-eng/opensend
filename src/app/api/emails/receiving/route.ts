import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { createReceivedEmailService } from "@opensend/core";

const receivedEmailService = createReceivedEmailService();

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);

  try {
    const result = await receivedEmailService.listReceivedEmails({
      limit: Number(url.searchParams.get("limit")) || 20,
      after: url.searchParams.get("after") || undefined,
      to: url.searchParams.get("to"),
    });

    return Response.json(result);
  } catch (error) {
    console.error("Failed to fetch received emails:", error);
    return Response.json(
      { error: "Failed to fetch received emails" },
      { status: 500 },
    );
  }
}
