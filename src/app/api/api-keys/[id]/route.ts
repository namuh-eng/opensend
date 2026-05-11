import { invalidateApiKeyAuthCache } from "@/lib/api-auth";
import { createApiKeyService, toApiKeyDetailResponse } from "@opensend/core";
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeApiKeyRoute(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  try {
    await apiKeyService().deleteApiKey(id, auth.userId);

    return new Response(null, { status: 200 });
  } catch (err) {
    return mapApiKeyServiceError(err, "Failed to delete API key");
  }
}
