import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { LogReadServiceError, createLogReadService } from "@opensend/core";

const logReadService = createLogReadService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const { id } = await params;

  try {
    const log = await logReadService.getLog(auth.userId, id);
    return Response.json(log);
  } catch (err) {
    if (err instanceof LogReadServiceError && err.code === "not_found") {
      return Response.json({ error: "Log not found" }, { status: 404 });
    }

    const message =
      err instanceof Error ? err.message : "Failed to retrieve log";
    return Response.json({ error: message }, { status: 500 });
  }
}
