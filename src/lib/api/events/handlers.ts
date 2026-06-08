import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  createCustomEventSchema,
  eventIdentifierSchema,
  listEventsQuerySchema,
  sendEventSchema,
  updateCustomEventSchema,
} from "@/lib/validation/events";
import { resumeWaitingRunsForEvent } from "@/lib/workers/automation-runner";
import {
  AutomationValidationError,
  CustomEventServiceError,
  createCustomEventService,
} from "@opensend/core";

const customEventService = createCustomEventService({
  resumeWaitingRunsForEvent,
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "23505"
  );
}

function validationResponse(details: unknown): Response {
  return Response.json(
    { error: "Validation failed", details },
    { status: 422 },
  );
}

function mapCreateOrUpdateEventError(err: unknown): Response {
  if (err instanceof CustomEventServiceError && err.code === "not_found") {
    return Response.json({ error: err.message }, { status: 404 });
  }
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
  const message = err instanceof Error ? err.message : "Failed to save event";
  return Response.json({ error: message }, { status: 500 });
}

function mapGetEventError(err: unknown): Response {
  if (err instanceof CustomEventServiceError && err.code === "not_found") {
    return Response.json({ error: err.message }, { status: 404 });
  }
  const message =
    err instanceof Error ? err.message : "Failed to retrieve event";
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

type EventRouteAuthResult =
  | { ok: true; auth: NonNullable<Awaited<ReturnType<typeof validateApiKey>>> }
  | { ok: false; response: Response };

async function authorizeEventRequest(
  request: Request,
): Promise<EventRouteAuthResult> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return { ok: false, response: unauthorizedResponse() };
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError !== null) {
    return { ok: false, response: permissionError };
  }
  return { ok: true, auth };
}

async function readJsonBody(request: Request): Promise<unknown> {
  return await request.json();
}

export async function handleCreateCustomEventRequest(
  request: Request,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createCustomEventSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error.flatten());

  try {
    const event = await customEventService.createCustomEvent({
      userId: authResult.auth.userId,
      data: parsed.data,
    });
    return Response.json(event, { status: 201 });
  } catch (err) {
    return mapCreateOrUpdateEventError(err);
  }
}

export async function handleListCustomEventsRequest(
  request: Request,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const parsed = listEventsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    after: url.searchParams.get("after") ?? undefined,
  });
  if (!parsed.success) return validationResponse(parsed.error.flatten());

  try {
    const list = await customEventService.listCustomEvents({
      userId: authResult.auth.userId,
      limit: parsed.data.limit,
      after: parsed.data.after,
    });
    return Response.json(list);
  } catch (err) {
    return mapListEventError(err);
  }
}

export async function handleGetCustomEventRequest(
  request: Request,
  identifier: string,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  const parsed = eventIdentifierSchema.safeParse(identifier);
  if (!parsed.success) return validationResponse(parsed.error.flatten());

  try {
    return Response.json(
      await customEventService.getCustomEvent({
        userId: authResult.auth.userId,
        identifier: parsed.data,
      }),
    );
  } catch (err) {
    return mapGetEventError(err);
  }
}

export async function handleUpdateCustomEventRequest(
  request: Request,
  identifier: string,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  const parsedIdentifier = eventIdentifierSchema.safeParse(identifier);
  if (!parsedIdentifier.success) {
    return validationResponse(parsedIdentifier.error.flatten());
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateCustomEventSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error.flatten());

  try {
    return Response.json(
      await customEventService.updateCustomEvent({
        userId: authResult.auth.userId,
        identifier: parsedIdentifier.data,
        data: parsed.data,
      }),
    );
  } catch (err) {
    return mapCreateOrUpdateEventError(err);
  }
}

export async function handleDeleteCustomEventRequest(
  request: Request,
  identifier: string,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  const parsed = eventIdentifierSchema.safeParse(identifier);
  if (!parsed.success) return validationResponse(parsed.error.flatten());

  try {
    return Response.json(
      await customEventService.deleteCustomEvent({
        userId: authResult.auth.userId,
        identifier: parsed.data,
      }),
    );
  } catch (err) {
    return mapDeleteEventError(err);
  }
}

export async function handleDeleteCustomEventCollectionRequest(
  request: Request,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return validationResponse({
      formErrors: [],
      fieldErrors: { id: ["Required"] },
    });
  }

  try {
    return Response.json(
      await customEventService.deleteCustomEvent({
        userId: authResult.auth.userId,
        id,
      }),
    );
  } catch (err) {
    return mapDeleteEventError(err);
  }
}

export async function handleSendCustomEventRequest(
  request: Request,
): Promise<Response> {
  const authResult = await authorizeEventRequest(request);
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendEventSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error.flatten());

  try {
    return Response.json(
      await customEventService.sendCustomEvent({
        userId: authResult.auth.userId,
        data: parsed.data,
      }),
      { status: 202 },
    );
  } catch (err) {
    return mapSendEventError(err);
  }
}
