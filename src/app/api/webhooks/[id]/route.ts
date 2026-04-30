import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { updateWebhookSchema } from "@/lib/validation/webhooks";
import { eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!webhook) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      id: webhook.id,
      endpoint: webhook.url,
      events: webhook.eventTypes,
      status: webhook.status === "active" ? "enabled" : "disabled",
      created_at: webhook.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retrieve webhook";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updateWebhookSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const validated = result.data;
    const updateData: Record<string, unknown> = {};
    if (validated.endpoint !== undefined) updateData.url = validated.endpoint;
    if (validated.url !== undefined) updateData.url = validated.url;

    if (validated.events !== undefined)
      updateData.eventTypes = validated.events;
    if (validated.event_types !== undefined)
      updateData.eventTypes = validated.event_types;

    // Support "active" (boolean) and "status" ("enabled"/"disabled").
    if (validated.status !== undefined) {
      updateData.status =
        validated.status === "enabled" ? "active" : "disabled";
    } else if (validated.active !== undefined) {
      updateData.status = validated.active ? "active" : "disabled";
    }

    const [updated] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, id))
      .returning();

    if (!updated) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      id: updated.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update webhook";
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
    const [deleted] = await db
      .delete(webhooks)
      .where(eq(webhooks.id, id))
      .returning({ id: webhooks.id });

    if (!deleted) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      id: deleted.id,
      deleted: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete webhook";
    return Response.json({ error: message }, { status: 500 });
  }
}
