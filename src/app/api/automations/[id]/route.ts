import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { updateAutomationSchema } from "@/lib/validation/automations";
import {
  AutomationServiceError,
  AutomationValidationError,
  createAutomationService,
} from "@opensend/core";

const automationService = createAutomationService();

function mapAutomationServiceError(err: unknown): Response | null {
  if (err instanceof AutomationServiceError) {
    if (err.code === "not_found") {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }
    if (err.code === "delete_forbidden") {
      return Response.json(
        {
          error: err.message,
          code: "automation_enabled",
        },
        { status: 409 },
      );
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const { id } = await params;
  try {
    return Response.json(
      await automationService.getAutomation(auth.userId, id),
    );
  } catch (err) {
    const mapped = mapAutomationServiceError(err);
    if (mapped) return mapped;
    const message =
      err instanceof Error ? err.message : "Failed to retrieve automation";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
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

  const parsed = updateAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = await params;
  try {
    return Response.json(
      await automationService.updateAutomation({
        userId: auth.userId,
        id,
        data: parsed.data,
      }),
    );
  } catch (err) {
    const mapped = mapAutomationServiceError(err);
    if (mapped) return mapped;
    if (err instanceof AutomationValidationError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to update automation";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const { id } = await params;
  try {
    return Response.json(
      await automationService.deleteAutomation(auth.userId, id),
    );
  } catch (err) {
    const mapped = mapAutomationServiceError(err);
    if (mapped) return mapped;
    const message =
      err instanceof Error ? err.message : "Failed to delete automation";
    return Response.json({ error: message }, { status: 500 });
  }
}
