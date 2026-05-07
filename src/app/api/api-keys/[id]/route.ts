import {
  authorizeDashboardOrApiKey,
  getServerSession,
  invalidateApiKeyAuthCache,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { ApiKeyServiceError, createApiKeyService } from "@opensend/core";

function apiKeyService() {
  return createApiKeyService({
    invalidateAuthCache: invalidateApiKeyAuthCache,
  });
}

function mapServiceError(err: unknown, fallback: string): Response {
  if (err instanceof ApiKeyServiceError) {
    return Response.json({ error: err.message }, { status: 404 });
  }

  const message = err instanceof Error ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return unauthorizedResponse();
  }
  const permissionError =
    "apiKeyId" in auth ? requireFullAccessApiKey(auth) : null;
  if (permissionError) return permissionError;
  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  try {
    const key = await apiKeyService().getApiKey(id, userId);

    return Response.json({
      object: "api_key",
      id: key.id,
      name: key.name,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
      permission: key.permission,
      domain: key.domain,
    });
  } catch (err) {
    return mapServiceError(err, "Failed to get API key");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return unauthorizedResponse();
  }
  const permissionError =
    "apiKeyId" in auth ? requireFullAccessApiKey(auth) : null;
  if (permissionError) return permissionError;
  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  try {
    await apiKeyService().deleteApiKey(id, userId);

    return new Response(null, { status: 200 });
  } catch (err) {
    return mapServiceError(err, "Failed to delete API key");
  }
}
