import { invalidateApiKeyAuthCache } from "@/lib/api-auth";
import { recordAuditEvent } from "@/lib/audit-events";
import {
  createApiKeyService,
  parseUpdateApiKeyBody,
  toApiKeyDetailResponse,
} from "@opensend/core";
import { authorizeApiKeyRoute, mapApiKeyServiceError } from "../route-helpers";

function apiKeyService() {
  return createApiKeyService({
    invalidateAuthCache: invalidateApiKeyAuthCache,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeApiKeyRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  try {
    const key = await apiKeyService().getApiKey(id, auth.userId);

    return Response.json(toApiKeyDetailResponse(key));
  } catch (err) {
    return mapApiKeyServiceError(err, "Failed to get API key");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeApiKeyRoute(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = await params;
  const parsed = parseUpdateApiKeyBody(body);

  try {
    const updated = await apiKeyService().updateApiKey(id, auth.userId, parsed);

    await recordAuditEvent({
      context: auth.auditContext,
      action: "api_key.updated",
      targetType: "api_key",
      targetId: updated.id,
      metadata: {
        name: parsed.name,
        permission: parsed.permission,
        domain_id: parsed.domainId,
      },
    });

    return Response.json(toApiKeyDetailResponse(updated));
  } catch (err) {
    return mapApiKeyServiceError(err, "Failed to update API key");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeApiKeyRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  try {
    await apiKeyService().deleteApiKey(id, auth.userId);

    await recordAuditEvent({
      context: auth.auditContext,
      action: "api_key.deleted",
      targetType: "api_key",
      targetId: id,
    });

    return new Response(null, { status: 200 });
  } catch (err) {
    return mapApiKeyServiceError(err, "Failed to delete API key");
  }
}
