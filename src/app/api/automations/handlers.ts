import {
  createAutomationSchema,
  listAutomationsQuerySchema,
  listRunsQuerySchema,
  updateAutomationSchema,
} from "@/lib/validation/automations";
import {
  AutomationRunServiceError,
  AutomationServiceError,
  AutomationValidationError,
  createAutomationRunService,
  createAutomationService,
} from "@opensend/core";

export type AutomationHandlerAuth = { userId: string };

const automationService = createAutomationService();
const automationRunService = createAutomationRunService();

export function mapAutomationServiceError(err: unknown): Response | null {
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

export async function handleCreateAutomation(
  request: Request,
  auth: AutomationHandlerAuth,
): Promise<Response> {
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

export async function handleListAutomations(
  request: Request,
  auth: AutomationHandlerAuth,
): Promise<Response> {
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

export async function handleGetAutomation(
  auth: AutomationHandlerAuth,
  id: string,
): Promise<Response> {
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

export async function handleUpdateAutomation(
  request: Request,
  auth: AutomationHandlerAuth,
  id: string,
): Promise<Response> {
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

export async function handleDeleteAutomation(
  auth: AutomationHandlerAuth,
  id: string,
): Promise<Response> {
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

export async function handleStopAutomation(
  auth: AutomationHandlerAuth,
  id: string,
): Promise<Response> {
  try {
    return Response.json(
      await automationService.stopAutomation(auth.userId, id),
    );
  } catch (err) {
    const mapped = mapAutomationServiceError(err);
    if (mapped) return mapped;
    const message =
      err instanceof Error ? err.message : "Failed to stop automation";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function handleListAutomationRuns(
  request: Request,
  auth: AutomationHandlerAuth,
  automationId: string,
): Promise<Response> {
  const url = new URL(request.url);
  const parsed = listRunsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
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
    const result = await automationRunService.listRuns({
      automationId,
      userId: auth.userId,
      ...parsed.data,
    });

    return Response.json(result);
  } catch (err) {
    return mapAutomationRunServiceError(err, "Failed to list automation runs");
  }
}

export async function handleGetAutomationRun(
  auth: AutomationHandlerAuth,
  automationId: string,
  runId: string,
): Promise<Response> {
  try {
    const run = await automationRunService.getRun({
      automationId,
      runId,
      userId: auth.userId,
    });
    return Response.json(run);
  } catch (err) {
    return mapAutomationRunServiceError(
      err,
      "Failed to retrieve automation run",
    );
  }
}
