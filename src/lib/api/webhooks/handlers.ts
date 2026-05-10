import {
  type AuthResult,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import {
  createWebhookSchema,
  updateWebhookSchema,
} from "@/lib/validation/webhooks";
import {
  type WebhookDeliveryListItem,
  type WebhookServiceCreateResult,
  type WebhookServiceDetail,
  type WebhookServiceListItem,
  createWebhookService,
} from "@opensend/core";

function webhookService() {
  return createWebhookService();
}

function mapWebhookError(error: unknown, fallback: string): Response {
  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

function mapWebhookListItem(webhook: WebhookServiceListItem) {
  return {
    id: webhook.id,
    endpoint: webhook.endpoint,
    events: webhook.events,
    status: webhook.status,
    created_at: webhook.createdAt,
  };
}

function mapWebhookCreateResult(webhook: WebhookServiceCreateResult) {
  return {
    object: "webhook",
    ...mapWebhookListItem(webhook),
    signing_secret: webhook.signingSecret,
  };
}

function mapDelivery(delivery: WebhookDeliveryListItem) {
  return {
    id: delivery.id,
    status: delivery.status,
    attempt: delivery.attempt,
    status_code: delivery.statusCode,
    response_body: delivery.responseBody,
    attempted_at: delivery.attemptedAt,
    next_retry_at: delivery.nextRetryAt,
    created_at: delivery.createdAt,
  };
}

function mapWebhookDetail(webhook: WebhookServiceDetail) {
  return {
    object: "webhook",
    ...mapWebhookListItem(webhook),
    recent_deliveries: (webhook.recentDeliveries ?? []).map(mapDelivery),
  };
}

type WebhookAuth = AuthResult & { userId: string };

type WebhookAuthResult =
  | { ok: true; auth: WebhookAuth }
  | { ok: false; response: Response };

async function requireWebhookAuth(
  request: Request,
): Promise<WebhookAuthResult> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth?.userId) return { ok: false, response: unauthorizedResponse() };

  const permissionError = requireFullAccessApiKey(auth);
  if (permissionError) return { ok: false, response: permissionError };

  return { ok: true, auth: { ...auth, userId: auth.userId } };
}

export async function handleListWebhooksRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireWebhookAuth(request);
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 20;
  const after = url.searchParams.get("after") || "";

  try {
    const result = await webhookService().listWebhooks({
      userId: authResult.auth.userId,
      limit,
      after,
    });

    return Response.json({
      object: "list",
      data: result.data.map(mapWebhookListItem),
      has_more: result.hasMore,
    });
  } catch (error) {
    return mapWebhookError(error, "Failed to list webhooks");
  }
}

export async function handleCreateWebhookRequest(
  request: Request,
): Promise<Response> {
  const authResult = await requireWebhookAuth(request);
  if (!authResult.ok) return authResult.response;

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
      userId: authResult.auth.userId,
      endpoint,
      events,
    });

    return Response.json(mapWebhookCreateResult(webhook), { status: 201 });
  } catch (error) {
    return mapWebhookError(error, "Failed to create webhook");
  }
}

export async function handleGetWebhookRequest(
  request: Request,
  id: string,
): Promise<Response> {
  const authResult = await requireWebhookAuth(request);
  if (!authResult.ok) return authResult.response;

  try {
    const webhook = await webhookService().getWebhook(
      id,
      authResult.auth.userId,
    );

    if (!webhook) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json(mapWebhookDetail(webhook));
  } catch (error) {
    return mapWebhookError(error, "Failed to retrieve webhook");
  }
}

export async function handleUpdateWebhookRequest(
  request: Request,
  id: string,
): Promise<Response> {
  const authResult = await requireWebhookAuth(request);
  if (!authResult.ok) return authResult.response;

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
      authResult.auth.userId,
      {
        endpoint: validated.endpoint ?? validated.url,
        events: validated.events ?? validated.event_types,
        status: validated.status,
        active: validated.active,
      },
    );

    if (!updated) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({
      object: "webhook",
      ...mapWebhookListItem(updated),
    });
  } catch (error) {
    return mapWebhookError(error, "Failed to update webhook");
  }
}

export async function handleDeleteWebhookRequest(
  request: Request,
  id: string,
): Promise<Response> {
  const authResult = await requireWebhookAuth(request);
  if (!authResult.ok) return authResult.response;

  try {
    const deleted = await webhookService().deleteWebhook(
      id,
      authResult.auth.userId,
    );

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
