import { recordAuditEvent } from "@/lib/audit-events";
import {
  integrationConnectionIdSchema,
  updateWebhookIntegrationSchema,
} from "@/lib/validation/integrations";
import { createIntegrationService } from "@opensend/core";
import {
  authorizeIntegrationRoute,
  mapIntegrationConnection,
  mapIntegrationServiceError,
} from "../../route-helpers";

function service() {
  return createIntegrationService();
}

function validationResponse(error: { flatten: () => unknown }) {
  return Response.json(
    { error: "Validation failed", details: error.flatten() },
    { status: 422 },
  );
}

async function parseConnectionId(
  params: Promise<{ id: string }>,
): Promise<string | Response> {
  const { id } = await params;
  const parsed = integrationConnectionIdSchema.safeParse(id);
  if (!parsed.success) {
    return Response.json({ error: "Invalid integration id" }, { status: 400 });
  }
  return parsed.data;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  const idOrResponse = await parseConnectionId(params);
  if (idOrResponse instanceof Response) return idOrResponse;
  const id = idOrResponse;
  try {
    const connection = await service().getConnection({
      id,
      userId: auth.userId,
    });
    if (!connection) {
      return Response.json({ error: "Integration not found" }, { status: 404 });
    }
    return Response.json({
      object: "integration_connection",
      data: mapIntegrationConnection(connection),
    });
  } catch (error) {
    return mapIntegrationServiceError(error, "Failed to retrieve integration");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = updateWebhookIntegrationSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error);

  const idOrResponse = await parseConnectionId(params);
  if (idOrResponse instanceof Response) return idOrResponse;
  const id = idOrResponse;
  try {
    const connection = await service().updateWebhookConnection({
      id,
      userId: auth.userId,
      update: {
        name: parsed.data.name,
        webhookUrl: parsed.data.webhook_url,
        signingSecret: parsed.data.signing_secret,
      },
    });

    await recordAuditEvent({
      context: auth.auditContext,
      action: "integration.updated",
      targetType: "integration",
      targetId: connection.id,
      metadata: {
        provider: connection.provider,
        name: connection.name,
        endpoint_preview: connection.config.webhook?.endpointPreview,
        has_signing_secret: connection.config.webhook?.hasSigningSecret,
      },
    });

    return Response.json({
      object: "integration_connection",
      data: mapIntegrationConnection(connection),
    });
  } catch (error) {
    return mapIntegrationServiceError(error, "Failed to update integration");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeIntegrationRoute(request);
  if ("response" in auth) return auth.response;

  const idOrResponse = await parseConnectionId(params);
  if (idOrResponse instanceof Response) return idOrResponse;
  const id = idOrResponse;
  try {
    const connection = await service().disconnect({ id, userId: auth.userId });

    await recordAuditEvent({
      context: auth.auditContext,
      action: "integration.disconnected",
      targetType: "integration",
      targetId: connection.id,
      metadata: {
        provider: connection.provider,
        name: connection.name,
      },
    });

    return Response.json({
      object: "integration_connection",
      data: mapIntegrationConnection(connection),
    });
  } catch (error) {
    return mapIntegrationServiceError(
      error,
      "Failed to disconnect integration",
    );
  }
}
