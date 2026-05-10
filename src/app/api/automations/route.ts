import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  createAutomationSchema,
  listAutomationsQuerySchema,
} from "@/lib/validation/automations";
import {
  AutomationValidationError,
  createAutomationService,
} from "@opensend/core";

const automationService = createAutomationService();

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

  const parsed = createAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const created = await automationService.createAutomation({
      userId: auth.userId,
      data: parsed.data,
    });

    return Response.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof AutomationValidationError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: 422 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to create automation";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  const url = new URL(request.url);
  const parsed = listAutomationsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
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
    const list = await automationService.listAutomations({
      userId: auth.userId,
      limit: parsed.data.limit,
      after: parsed.data.after,
      status: parsed.data.status,
      search: parsed.data.search,
    });

    return Response.json(list);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list automations";
    return Response.json({ error: message }, { status: 500 });
  }
}
