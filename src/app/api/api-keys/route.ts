import {
  authorizeDashboardOrApiKey,
  getServerSession,
  invalidateApiKeyAuthCache,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessApiKey } from "@/lib/api-key-permissions";
import { checkApiKeyQuota, quotaExceededResponse } from "@/lib/billing/quota";
import {
  type ApiKeyPermission,
  ApiKeyServiceError,
  createApiKeyService,
} from "@opensend/core";

function apiKeyService() {
  return createApiKeyService({
    invalidateAuthCache: invalidateApiKeyAuthCache,
  });
}

function mapServiceError(err: unknown, fallback: string): Response {
  if (err instanceof ApiKeyServiceError) {
    const status = err.code === "not_found" ? 404 : 422;
    return Response.json({ error: err.message }, { status });
  }

  const message = err instanceof Error ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}

function parseCreateApiKeyBody(body: unknown): {
  name: string;
  permission?: ApiKeyPermission;
  domainId?: string;
} {
  const data = body && typeof body === "object" ? body : {};
  const record = data as Record<string, unknown>;
  const permission = record.permission;
  const domainId = record.domain_id;

  return {
    name: typeof record.name === "string" ? record.name : "",
    permission:
      permission === "full_access" || permission === "sending_access"
        ? permission
        : undefined,
    domainId: typeof domainId === "string" ? domainId : undefined,
  };
}

export async function GET(request: Request): Promise<Response> {
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

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 20;
  const after = url.searchParams.get("after") || "";

  try {
    const result = await apiKeyService().listApiKeys({
      userId,
      limit,
      after,
    });

    return Response.json({
      object: "list",
      data: result.data.map((key) => ({
        id: key.id,
        name: key.name,
        created_at: key.createdAt,
        last_used_at: key.lastUsedAt,
        permission: key.permission,
        domain: key.domain,
      })),
      has_more: result.hasMore,
    });
  } catch (err) {
    return mapServiceError(err, "Failed to list API keys");
  }
}

export async function POST(request: Request): Promise<Response> {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const quota = await checkApiKeyQuota(userId);
    if (!quota.ok) {
      return quotaExceededResponse(quota.info);
    }

    const created = await apiKeyService().createApiKey({
      ...parseCreateApiKeyBody(body),
      userId,
    });

    return Response.json(
      {
        id: created.id,
        token: created.token,
      },
      { status: 201 },
    );
  } catch (err) {
    return mapServiceError(err, "Failed to create API key");
  }
}
