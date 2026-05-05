import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import { updateWebhookSchema } from "@/lib/validation/webhooks";
import { createWebhookService } from "@opensend/core";

function webhookService() {
  return createWebhookService();
}

function mapWebhookError(error: unknown, fallback: string): Response {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    const webhook = await webhookService().getWebhook(id, {
      userId: auth.userId,
    });

    if (!webhook) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      id: webhook.id,
      endpoint: webhook.endpoint,
      events: webhook.events,
      status: webhook.status,
      created_at: webhook.createdAt,
    });
  } catch (error) {
    return mapWebhookError(error, "Failed to retrieve webhook");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

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
    const updated = await webhookService().updateWebhook(
      id,
      {
        endpoint: validated.endpoint ?? validated.url,
        events: validated.events ?? validated.event_types,
        status: validated.status,
        active: validated.active,
      },
      { userId: auth.userId },
    );

    if (!updated) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      id: updated.id,
      endpoint: updated.endpoint,
      events: updated.events,
      status: updated.status,
      created_at: updated.createdAt,
    });
  } catch (error) {
    return mapWebhookError(error, "Failed to update webhook");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth || !auth.userId) return unauthorizedResponse();

  const { id } = await params;

  try {
    const deleted = await webhookService().deleteWebhook(id, {
      userId: auth.userId,
    });

    if (!deleted) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      id: deleted.id,
      deleted: true,
    });
  } catch (error) {
    return mapWebhookError(error, "Failed to delete webhook");
  }
}
