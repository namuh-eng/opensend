import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { sendEventSchema } from "@/lib/validation/events";
import { resumeWaitingRunsForEvent } from "@/lib/workers/automation-runner";
import {
  AutomationValidationError,
  CustomEventServiceError,
  createCustomEventService,
} from "@opensend/core";

const customEventService = createCustomEventService({
  resumeWaitingRunsForEvent,
});

function mapSendEventError(err: unknown): Response {
  if (err instanceof CustomEventServiceError) {
    if (
      err.code === "event_schema_invalid" ||
      err.code === "event_payload_invalid"
    ) {
      return Response.json(
        { error: err.message, code: err.code, details: err.details ?? [] },
        { status: 422 },
      );
    }
  }

  if (err instanceof AutomationValidationError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 },
    );
  }
  const message = err instanceof Error ? err.message : "Failed to send event";
  return Response.json({ error: message }, { status: 500 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    return Response.json(
      await customEventService.sendCustomEvent({
        userId: auth.userId,
        data: parsed.data,
      }),
      { status: 202 },
    );
  } catch (err) {
    return mapSendEventError(err);
  }
}
