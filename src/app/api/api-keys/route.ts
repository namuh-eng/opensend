import { invalidateApiKeyAuthCache } from "@/lib/api-auth";
import { checkApiKeyQuota, quotaExceededResponse } from "@/lib/billing/quota";
import {
  createApiKeyService,
  parseCreateApiKeyBody,
  toApiKeyCreateResponse,
  toApiKeyListResponse,
} from "@opensend/core";
import { authorizeApiKeyRoute, mapApiKeyServiceError } from "./route-helpers";

function apiKeyService() {
  return createApiKeyService({
    invalidateAuthCache: invalidateApiKeyAuthCache,
  });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authorizeApiKeyRoute(request);
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 20;
  const after = url.searchParams.get("after") || "";

  try {
    const result = await apiKeyService().listApiKeys({
      userId: auth.userId,
      limit,
      after,
    });

    return Response.json(toApiKeyListResponse(result));
  } catch (err) {
    return mapApiKeyServiceError(err, "Failed to list API keys");
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorizeApiKeyRoute(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const quota = await checkApiKeyQuota(auth.userId);
    if (!quota.ok) {
      return quotaExceededResponse(quota.info);
    }

    const created = await apiKeyService().createApiKey({
      ...parseCreateApiKeyBody(body),
      userId: auth.userId,
    });

    return Response.json(toApiKeyCreateResponse(created), { status: 201 });
  } catch (err) {
    return mapApiKeyServiceError(err, "Failed to create API key");
  }
}
