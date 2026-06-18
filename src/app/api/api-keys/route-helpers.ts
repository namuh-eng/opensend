import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import type { AuditContext } from "@/lib/audit-events";
import { resolveWorkspaceRouteContext } from "@/lib/workspace-route-auth";
import { ApiKeyServiceError, type WorkspaceContext } from "@opensend/core";

type ApiKeyRouteAuth = NonNullable<
  Awaited<ReturnType<typeof authorizeDashboardOrApiKey>>
>;

export async function authorizeApiKeyRoute(request: Request): Promise<
  | {
      userId: string;
      auditContext: AuditContext;
      workspace: WorkspaceContext;
    }
  | { response: Response }
> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return { response: unauthorizedResponse() };

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return { response: permissionError };

  const session = "dashboard" in auth ? await getServerSession() : undefined;
  const workspace = await resolveWorkspaceRouteContext({
    request,
    auth: auth as ApiKeyRouteAuth,
    action: "api_keys.manage",
    session,
  });
  if ("response" in workspace) return workspace;

  return {
    userId: workspace.tenantUserId,
    auditContext: workspace.auditContext,
    workspace: workspace.workspace,
  };
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
