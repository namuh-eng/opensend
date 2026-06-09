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
import {
  type IntegrationCatalogItem,
  type IntegrationConnectionPublic,
  IntegrationServiceError,
} from "@opensend/core";

type IntegrationRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

async function resolveAuditContext(
  auth: IntegrationRouteAuth,
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

export async function authorizeIntegrationRoute(
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

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function mapIntegrationConnection(
  connection: IntegrationConnectionPublic,
) {
  return {
    id: connection.id,
    provider: connection.provider,
    name: connection.name,
    status: connection.status,
    scopes: connection.scopes,
    config: connection.config,
    health: connection.health,
    last_health_check_at: iso(connection.lastHealthCheckAt),
    last_sync_at: iso(connection.lastSyncAt),
    last_event_at: iso(connection.lastEventAt),
    last_error: connection.lastError,
    created_at: connection.createdAt.toISOString(),
    updated_at: connection.updatedAt.toISOString(),
  };
}

export function mapIntegrationCatalogItem(item: IntegrationCatalogItem) {
  return {
    provider: item.provider,
    name: item.name,
    description: item.description,
    status: item.status,
    connection: item.connection
      ? mapIntegrationConnection(item.connection)
      : null,
  };
}

export function mapIntegrationServiceError(
  error: unknown,
  fallback: string,
): Response {
  if (error instanceof IntegrationServiceError) {
    const status =
      error.code === "not_found"
        ? 404
        : error.code === "dispatch_failed"
          ? 502
          : 422;
    return Response.json({ error: error.message }, { status });
  }

  const message = error instanceof Error ? error.message : fallback;
  return Response.json({ error: message }, { status: 500 });
}
