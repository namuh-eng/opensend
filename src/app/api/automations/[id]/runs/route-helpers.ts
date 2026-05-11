import {
  AutomationRunServiceError,
  createAutomationRunService,
} from "@opensend/core";
import { authorizeAutomationRoute } from "../../route-helpers";

export const automationRunService = createAutomationRunService();

export async function authorizeAutomationRunRoute(
  request: Request,
): Promise<{ userId: string } | { response: Response }> {
  return authorizeAutomationRoute(request);
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
