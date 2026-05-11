import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  createCustomEventSchema,
  listEventsQuerySchema,
} from "@/lib/validation/events";
import {
  AutomationValidationError,
  CustomEventServiceError,
  createCustomEventService,
} from "@opensend/core";

const customEventService = createCustomEventService();

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "23505"
  );
}

function mapCreateEventError(err: unknown): Response {
  if (err instanceof AutomationValidationError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: 422 },
    );
  }
  if (isUniqueViolation(err)) {
    return Response.json(
      { error: "An event with this name already exists" },
      { status: 409 },
    );
  }
  const message = err instanceof Error ? err.message : "Failed to create event";
  return Response.json({ error: message }, { status: 500 });
}

function mapListEventError(err: unknown): Response {
  const message = err instanceof Error ? err.message : "Failed to list events";
  return Response.json({ error: message }, { status: 500 });
}

function mapDeleteEventError(err: unknown): Response {
  if (err instanceof CustomEventServiceError && err.code === "not_found") {
    return Response.json({ error: err.message }, { status: 404 });
  }
  const message = err instanceof Error ? err.message : "Failed to delete event";
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

  const parsed = createCustomEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const event = await customEventService.createCustomEvent({
      userId: auth.userId,
      data: parsed.data,
    });
    return Response.json(event, { status: 201 });
  } catch (err) {
    return mapCreateEventError(err);
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const parsed = listEventsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    after: url.searchParams.get("after") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const list = await customEventService.listCustomEvents({
      userId: auth.userId,
      limit: parsed.data.limit,
      after: parsed.data.after,
    });
    return Response.json(list);
  } catch (err) {
    return mapListEventError(err);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json(
      {
        error: "Validation failed",
        details: {
          formErrors: [],
          fieldErrors: { id: ["Required"] },
        },
      },
      { status: 422 },
    );
  }

  try {
    return Response.json(
      await customEventService.deleteCustomEvent({ userId: auth.userId, id }),
    );
  } catch (err) {
    return mapDeleteEventError(err);
  }
}
