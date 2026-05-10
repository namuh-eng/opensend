import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { formatRunDetail } from "@/lib/automations";
import { db } from "@/lib/db";
import { automationRuns, automations } from "@/lib/db/schema";
import { cancelAutomationRunSchema } from "@/lib/validation/automations";
import { and, eq, inArray } from "drizzle-orm";

const CANCELLABLE_RUN_STATUSES = ["queued", "waiting"] as const;

async function readJsonBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (!body.trim()) return {};
  return JSON.parse(body) as unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return permissionError;

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cancelAutomationRunSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { id, runId } = await params;
  try {
    const ownerConditions = [eq(automations.id, id)];
    if (auth.userId) ownerConditions.push(eq(automations.userId, auth.userId));
    const automation = await db.query.automations.findFirst({
      where: and(...ownerConditions),
    });
    if (!automation) {
      return Response.json({ error: "Automation not found" }, { status: 404 });
    }

    const run = await db.query.automationRuns.findFirst({
      where: and(
        eq(automationRuns.id, runId),
        eq(automationRuns.automationId, automation.id),
      ),
    });
    if (!run) return Response.json({ error: "Run not found" }, { status: 404 });

    if (
      !CANCELLABLE_RUN_STATUSES.includes(run.status as "queued" | "waiting")
    ) {
      return Response.json(
        {
          error: "Run is not cancellable",
          code: "run_not_cancellable",
        },
        { status: 409 },
      );
    }

    const now = new Date();
    const reason = parsed.data.reason ?? "cancelled_by_api";
    const stepStates = { ...(run.stepStates ?? {}) };
    if (run.currentStepKey) {
      stepStates[run.currentStepKey] = {
        ...(stepStates[run.currentStepKey] ?? { status: "pending" }),
        status: "cancelled",
        completedAt: now.toISOString(),
        output: {
          ...(stepStates[run.currentStepKey]?.output ?? {}),
          cancellation_reason: reason,
        },
      };
    }

    const [updated] = await db
      .update(automationRuns)
      .set({
        status: "cancelled",
        stepStates,
        completedAt: now,
        nextStepAt: null,
        failureReason: reason,
        updatedAt: now,
      })
      .where(
        and(
          eq(automationRuns.id, run.id),
          eq(automationRuns.automationId, automation.id),
          inArray(automationRuns.status, [...CANCELLABLE_RUN_STATUSES]),
        ),
      )
      .returning();

    if (!updated) {
      return Response.json(
        {
          error: "Run is not cancellable",
          code: "run_not_cancellable",
        },
        { status: 409 },
      );
    }

    return Response.json(formatRunDetail(updated));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to cancel automation run";
    return Response.json({ error: message }, { status: 500 });
  }
}
