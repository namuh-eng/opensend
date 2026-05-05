import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { formatAutomation, formatAutomationListItem } from "@/lib/automations";
import { db } from "@/lib/db";
import { automationRuns, automationSteps } from "@/lib/db/schema";
import { listAutomationsQuerySchema } from "@/lib/validation/automations";
import { createAutomationSchema } from "@/lib/validation/automations";
import {
  type AutomationStepInput,
  AutomationValidationError,
  automationRepo,
} from "@opensend/core";
import { count, desc, inArray } from "drizzle-orm";

function toStepInputs(
  steps: Array<{
    key: string;
    type: AutomationStepInput["type"];
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
    const { data, hasMore } = await automationRepo.list({
      limit: parsed.data.limit ?? 25,
      after: parsed.data.after,
      status: parsed.data.status,
      search: parsed.data.search,
      userId: auth.userId,
    });
    const automationIds = data.map((automation) => automation.id);
    const stepCountsByAutomationId = new Map<string, number>();
    const lastRunByAutomationId = new Map<
      string,
      { status: string; created_at: Date }
    >();

    if (automationIds.length > 0) {
      const stepCounts = await db
        .select({
          automationId: automationSteps.automationId,
          total: count(),
        })
        .from(automationSteps)
        .where(inArray(automationSteps.automationId, automationIds))
        .groupBy(automationSteps.automationId);

      for (const row of stepCounts) {
        stepCountsByAutomationId.set(row.automationId, Number(row.total));
      }

      const runs = await db
        .select({
          automationId: automationRuns.automationId,
          status: automationRuns.status,
          createdAt: automationRuns.createdAt,
        })
        .from(automationRuns)
        .where(inArray(automationRuns.automationId, automationIds))
        .orderBy(desc(automationRuns.createdAt));

      for (const run of runs) {
        if (!lastRunByAutomationId.has(run.automationId)) {
          lastRunByAutomationId.set(run.automationId, {
            status: run.status,
            created_at: run.createdAt,
          });
        }
      }
    }

    return Response.json({
      object: "list",
      data: data.map((automation) => ({
        ...formatAutomationListItem(automation),
        step_count: stepCountsByAutomationId.get(automation.id) ?? 0,
        last_run: lastRunByAutomationId.get(automation.id) ?? null,
      })),
      has_more: hasMore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list automations";
    return Response.json({ error: message }, { status: 500 });
  }
}
