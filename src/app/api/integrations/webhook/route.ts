import { recordAuditEvent } from "@/lib/audit-events";
import { connectWebhookIntegrationSchema } from "@/lib/validation/integrations";
import { createIntegrationService } from "@opensend/core";
import {
  authorizeIntegrationRoute,
  mapIntegrationConnection,
  mapIntegrationServiceError,
} from "../route-helpers";

function service() {
  return createIntegrationService();
}

function validationResponse(error: { flatten: () => unknown }) {
  return Response.json(
    { error: "Validation failed", details: error.flatten() },
    { status: 422 },
  );
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  try {
    const connection = await service().getWebhookConnection({
      userId: auth.userId,
    });
    return Response.json({
      object: "integration_connection",
      data: connection ? mapIntegrationConnection(connection) : null,
    });
  } catch (error) {
    return mapIntegrationServiceError(
      error,
      "Failed to retrieve webhook integration",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = connectWebhookIntegrationSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error);

  try {
    const connection = await service().connectWebhook({
      userId: auth.userId,
      name: parsed.data.name,
      webhookUrl: parsed.data.webhook_url,
      signingSecret: parsed.data.signing_secret,
    });

    await recordAuditEvent({
      context: auth.auditContext,
      action: "integration.connected",
      targetType: "integration",
      targetId: connection.id,
      metadata: {
        provider: "webhook",
        name: connection.name,
        endpoint_preview: connection.config.webhook?.endpointPreview,
        has_signing_secret: connection.config.webhook?.hasSigningSecret,
      },
    });

    return Response.json(
      {
        object: "integration_connection",
        data: mapIntegrationConnection(connection),
      },
      { status: 201 },
    );
  } catch (error) {
    return mapIntegrationServiceError(error, "Failed to connect integration");
  }
}
