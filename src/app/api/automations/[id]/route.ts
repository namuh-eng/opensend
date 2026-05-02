import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { formatAutomation } from "@/lib/automations";
import { db } from "@/lib/db";
import { automationSteps, automations } from "@/lib/db/schema";
import { updateAutomationSchema } from "@/lib/validation/automations";
import {
  type AutomationStepInput,
  AutomationValidationError,
  automationRepo,
} from "@opensend/core";
import { and, asc, eq } from "drizzle-orm";

async function findAutomationForCaller(id: string, userId: string | null) {
  const conditions = [eq(automations.id, id)];
  if (userId) conditions.push(eq(automations.userId, userId));
  return (
    (await db.query.automations.findFirst({ where: and(...conditions) })) ??
    null
  );
}

async function loadSteps(automationId: string) {
  return await db
    .select()
    .from(automationSteps)
    .where(eq(automationSteps.automationId, automationId))
    .orderBy(asc(automationSteps.position));
}

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  try {
    const automation = await findAutomationForCaller(id, auth.userId);
    if (!automation) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }
    return Response.json(formatAutomation(automation, await loadSteps(id)));
  } catch (err) {
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
  const validated = parsed.data;
  try {
    const existing = await findAutomationForCaller(id, auth.userId);
    if (!existing) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }

    if (validated.steps) {
      const normalized = automationRepo.validate({
        name: validated.name ?? existing.name,
        status:
          validated.status ??
          (existing.status as "draft" | "enabled" | "disabled"),
        triggerEventName:
          validated.trigger_event_name ??
          validated.triggerEventName ??
          existing.triggerEventName ??
          undefined,
        steps: toStepInputs(validated.steps),
        connections: validated.connections,
        userId: auth.userId,
      });

      await db.transaction(async (tx) => {
        await tx
          .delete(automationSteps)
          .where(eq(automationSteps.automationId, existing.id));
        await tx.insert(automationSteps).values(
          normalized.steps.map((step) => ({
            automationId: existing.id,
            key: step.key,
            type: step.type,
            config: step.config,
            position: step.position ?? 0,
          })),
        );
        await tx
          .update(automations)
          .set({
            name: validated.name ?? existing.name,
            status: validated.status ?? existing.status,
            triggerEventName: normalized.triggerEventName,
            connections: normalized.connections,
            updatedAt: new Date(),
          })
          .where(eq(automations.id, existing.id));
      });
    } else {
      const updates: Partial<typeof automations.$inferInsert> = {};
      if (validated.name !== undefined) updates.name = validated.name;
      if (validated.status !== undefined) updates.status = validated.status;
      if (validated.trigger_event_name !== undefined) {
        updates.triggerEventName = validated.trigger_event_name;
      }
      if (validated.triggerEventName !== undefined) {
        updates.triggerEventName = validated.triggerEventName;
      }
      if (validated.connections !== undefined)
        updates.connections = validated.connections;
      if (Object.keys(updates).length > 0) {
        await automationRepo.update(existing.id, updates);
      }
    }

    const refreshed = await findAutomationForCaller(id, auth.userId);
    if (!refreshed) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }
    return Response.json(formatAutomation(refreshed, await loadSteps(id)));
  } catch (err) {
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

  const { id } = await params;
  try {
    const automation = await findAutomationForCaller(id, auth.userId);
    if (!automation) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }
    if (automation.status === "enabled") {
      return Response.json(
        {
          error: "Disable the automation before deleting",
          code: "automation_enabled",
        },
        { status: 409 },
      );
    }
    await automationRepo.delete(automation.id);
    return Response.json({
      object: "automation",
      id: automation.id,
      deleted: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete automation";
    return Response.json({ error: message }, { status: 500 });
  }
}
