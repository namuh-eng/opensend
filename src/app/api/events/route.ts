import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { formatCustomEvent } from "@/lib/automations";
import {
  createCustomEventSchema,
  listEventsQuerySchema,
} from "@/lib/validation/events";
import { AutomationValidationError, customEventRepo } from "@namuh/core";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "23505"
  );
}

export async function POST(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

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
    const event = await customEventRepo.create({
      name: parsed.data.name,
      schema: parsed.data.schema ?? null,
      userId: auth.userId,
    });
    return Response.json(formatCustomEvent(event), { status: 201 });
  } catch (err) {
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
    const message =
      err instanceof Error ? err.message : "Failed to create event";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

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
    const { data, hasMore } = await customEventRepo.list({
      limit: parsed.data.limit ?? 50,
      after: parsed.data.after,
      userId: auth.userId,
    });
    return Response.json({
      object: "list",
      data: data.map(formatCustomEvent),
      has_more: hasMore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list events";
    return Response.json({ error: message }, { status: 500 });
  }
}
