import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { publicApiError } from "@/lib/api-errors";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  parseScheduledAt,
  scheduledAtValidationMessage,
} from "@/lib/validation/emails";
import {
  EmailDetailServiceError,
  createEmailDetailService,
} from "@opensend/core";

const emailDetailService = createEmailDetailService({ parseScheduledAt });

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
    const email = await emailDetailService.getEmail({
      userId: auth.userId,
      id,
    });
    return Response.json(email);
  } catch (err) {
    if (err instanceof EmailDetailServiceError && err.code === "not_found") {
      return Response.json({ error: "Email not found" }, { status: 404 });
    }

    const message =
      err instanceof Error ? err.message : "Failed to retrieve email";
    return Response.json({ error: message }, { status: 500 });
  }
}

function scheduledAtValidationResponse(): Response {
  return Response.json(
    publicApiError("validation_error", "Validation failed.", 422, {
      formErrors: [],
      fieldErrors: {
        scheduled_at: [scheduledAtValidationMessage],
      },
    }),
    { status: 422 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await emailDetailService.updateEmail({
      userId: auth.userId,
      id,
      body,
    });
    return Response.json(updated);
  } catch (err) {
    if (err instanceof EmailDetailServiceError) {
      if (err.code === "not_found") {
        return Response.json({ error: "Email not found" }, { status: 404 });
      }

      if (err.code === "invalid_state") {
        return Response.json({ error: err.message }, { status: 400 });
      }

      if (err.code === "invalid_scheduled_at") {
        return scheduledAtValidationResponse();
      }

      if (err.code === "no_fields") {
        return Response.json({ error: "No fields to update" }, { status: 400 });
      }
    }

    const message =
      err instanceof Error ? err.message : "Failed to update email";
    return Response.json({ error: message }, { status: 500 });
  }
}
