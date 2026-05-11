import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import {
  type AuditContext,
  auditContextForApiKey,
  auditContextForDashboardSession,
} from "@/lib/audit-events";
import { ApiKeyServiceError } from "@opensend/core";

type ApiKeyRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function resolveAuditContext(
  auth: ApiKeyRouteAuth,
): Promise<AuditContext | null> {
  if ("userId" in auth) {
    if (!auth.userId) return null;
    return auditContextForApiKey({
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
    });
  }

  const session = await getServerSession();
  return auditContextForDashboardSession(session);
}

export async function authorizeApiKeyRoute(
  request: Request,
): Promise<
  { userId: string; auditContext: AuditContext } | { response: Response }
> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return { response: unauthorizedResponse() };

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return { response: permissionError };

  const auditContext = await resolveAuditContext(auth);
  if (!auditContext) return { response: unauthorizedResponse() };

  return { userId: auditContext.userId, auditContext };
}

export function mapApiKeyServiceError(
  err: unknown,
  fallback: string,
): Response {
  if (err instanceof ApiKeyServiceError) {
    const status = err.code === "not_found" ? 404 : 422;
    return Response.json({ error: err.message }, { status });
  }

  const message = err instanceof Error ? err.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}
