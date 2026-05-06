import {
  invalidateApiKeyAuthCache,
  unauthorizedResponse,
  validateApiKey,
} from "@/lib/api-auth";
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
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth?.userId || auth.permission !== "full_access") {
    return unauthorizedResponse();
  }

  const { id } = await params;
  try {
    const key = await apiKeyService().getApiKey(id, auth.userId);

    return Response.json({
      object: "api_key",
      id: key.id,
      name: key.name,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
    });
  } catch (err) {
    return mapServiceError(err, "Failed to get API key");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth?.userId || auth.permission !== "full_access") {
    return unauthorizedResponse();
  }

  const { id } = await params;
  try {
    await apiKeyService().deleteApiKey(id, auth.userId);

    return new Response(null, { status: 200 });
  } catch (err) {
    return mapServiceError(err, "Failed to delete API key");
  }
}
