import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { formatAutomation, formatAutomationListItem } from "@/lib/automations";
import { listAutomationsQuerySchema } from "@/lib/validation/automations";
import { createAutomationSchema } from "@/lib/validation/automations";
import {
  type AutomationStepInput,
  AutomationValidationError,
  automationRepo,
} from "@opensend/core";

function toStepInputs(
  steps: Array<{
    key: string;
    type: "trigger" | "delay" | "send_email" | "end";
    config?: Record<string, unknown>;
    position?: number;
  }>,
): AutomationStepInput[] {
  return steps.map((step) => ({
    key: step.key,
    type: step.type,
    config: step.config ?? {},
    position: step.position,
  }));
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

  const parsed = createAutomationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const validated = parsed.data;
  try {
    const created = await automationRepo.create({
      name: validated.name,
      status: validated.status,
      triggerEventName:
        validated.trigger_event_name ?? validated.triggerEventName,
      steps: toStepInputs(validated.steps),
      connections: validated.connections,
      userId: auth.userId,
    });

    return Response.json(formatAutomation(created.automation, created.steps), {
      status: 201,
    });
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

  const url = new URL(request.url);
  const parsed = listAutomationsQuerySchema.safeParse({
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
    const { data, hasMore } = await automationRepo.list({
      limit: parsed.data.limit ?? 25,
      after: parsed.data.after,
      status: parsed.data.status,
      userId: auth.userId,
    });

    return Response.json({
      object: "list",
      data: data.map(formatAutomationListItem),
      has_more: hasMore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list automations";
    return Response.json({ error: message }, { status: 500 });
  }
}
