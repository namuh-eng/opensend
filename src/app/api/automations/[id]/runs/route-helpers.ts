import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  AutomationRunServiceError,
  createAutomationRunService,
} from "@opensend/core";

export const automationRunService = createAutomationRunService();

export async function authorizeAutomationRunRoute(
  request: Request,
): Promise<{ userId?: string | null } | { response: Response }> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return { response: unauthorizedResponse() };

  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return { response: permissionError };

  return { userId: auth.userId };
}

export function mapAutomationRunServiceError(
  err: unknown,
  fallback: string,
): Response {
  if (err instanceof AutomationRunServiceError) {
    if (err.code === "run_not_cancellable") {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 409 },
      );
    }

    return Response.json({ error: err.message }, { status: 404 });
  }

  const message = err instanceof Error ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}
