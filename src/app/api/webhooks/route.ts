import { unauthorizedResponse } from "@/lib/api-auth";
import { createWebhookSchema } from "@/lib/validation/webhooks";
import { createWebhookService } from "@opensend/core";
import { resolveWebhookRouteUserId } from "./auth";

function webhookService() {
  return createWebhookService();
}

function mapWebhookError(error: unknown, fallback: string): Response {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(request: Request): Promise<Response> {
  const userId = await resolveWebhookRouteUserId(
    request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 20;
  const after = url.searchParams.get("after") || "";

  try {
    const result = await webhookService().listWebhooks({
      limit,
      after,
      userId,
    });

    return Response.json({
      object: "list",
      data: result.data.map((webhook) => ({
        id: webhook.id,
        endpoint: webhook.endpoint,
        events: webhook.events,
        status: webhook.status,
        created_at: webhook.createdAt,
      })),
      has_more: result.hasMore,
    });
  } catch (error) {
    return mapWebhookError(error, "Failed to list webhooks");
  }
}

export async function POST(request: Request): Promise<Response> {
  const userId = await resolveWebhookRouteUserId(
    request.headers.get("authorization"),
  );
  if (!userId) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createWebhookSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const validated = result.data;
  const endpoint = validated.endpoint ?? validated.url;
  const events = validated.events ?? validated.event_types;

  if (!endpoint || !events) {
    return Response.json(
      { error: "Endpoint and events are required" },
      { status: 422 },
    );
  }

  try {
    const webhook = await webhookService().createWebhook({
      endpoint,
      events,
      userId,
    });

    return Response.json(
      {
        object: "webhook",
        id: webhook.id,
        endpoint: webhook.endpoint,
        events: webhook.events,
        status: webhook.status,
        signing_secret: webhook.signingSecret,
        created_at: webhook.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    return mapWebhookError(error, "Failed to create webhook");
  }
}
