import { type AuthResult, getServerSession } from "@/lib/api-auth";
import {
  type AuditContext,
  auditContextForApiKey,
  auditContextForDashboardSession,
} from "@/lib/audit-events";
import {
  type WorkspaceContext,
  type WorkspacePermissionAction,
  WorkspaceServiceError,
  workspaceService,
} from "@opensend/core";

export type WorkspaceRouteContext = {
  tenantUserId: string;
  actorUserId: string;
  workspace: WorkspaceContext;
  auditContext: AuditContext;
};

type DashboardAuth = { dashboard: true };
type DashboardSession = Awaited<ReturnType<typeof getServerSession>>;

export function getRequestedWorkspaceId(request: Request): string | null {
  const header = request.headers.get("x-opensend-workspace-id")?.trim();
  if (header) return header;

  const url = new URL(request.url);
  return url.searchParams.get("workspace_id")?.trim() || null;
}

function workspaceAuditContext(input: {
  tenantUserId: string;
  actorUserId: string;
  actorEmail?: string | null;
}): AuditContext {
  return {
    userId: input.tenantUserId,
    actor: {
      type: "user",
      id: input.actorUserId,
      email: input.actorEmail ?? null,
    },
    source: "dashboard",
    sourceApiKeyId: null,
  };
}

export function workspaceForbiddenResponse(message?: string): Response {
  return Response.json(
    {
      error:
        message ??
        "Your workspace role does not have permission to access this resource.",
    },
    { status: 403 },
  );
}

export function mapWorkspaceServiceError(error: unknown): Response {
  if (error instanceof WorkspaceServiceError) {
    const status =
      error.code === "forbidden"
        ? 403
        : error.code === "workspace_not_found" ||
            error.code === "invite_not_found" ||
            error.code === "member_not_found"
          ? 404
          : 422;
    return Response.json({ error: error.message }, { status });
  }

  console.error("Workspace service error:", error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export async function resolveWorkspaceRouteContext(input: {
  request: Request;
  auth: AuthResult | DashboardAuth;
  action: WorkspacePermissionAction;
  session?: DashboardSession;
}): Promise<WorkspaceRouteContext | { response: Response }> {
  const requestedWorkspaceId = getRequestedWorkspaceId(input.request);

  if ("apiKeyId" in input.auth) {
    if (!input.auth.userId) {
      return {
        response: Response.json(
          { error: "Missing or invalid API key" },
          { status: 401 },
        ),
      };
    }

    try {
      const workspace = await workspaceService.requirePermission({
        actorUserId: input.auth.userId,
        workspaceId: requestedWorkspaceId,
        action: input.action,
      });
      return {
        tenantUserId: workspace.tenantUserId,
        actorUserId: input.auth.userId,
        workspace,
        auditContext: auditContextForApiKey({
          userId: workspace.tenantUserId,
          apiKeyId: input.auth.apiKeyId,
        }),
      };
    } catch (error) {
      return { response: mapWorkspaceServiceError(error) };
    }
  }

  const session = input.session ?? (await getServerSession());
  const actorUserId = session?.user?.id;
  if (!actorUserId) {
    return {
      response: Response.json(
        { error: "Missing or invalid API key" },
        { status: 401 },
      ),
    };
  }

  try {
    const workspace = await workspaceService.requirePermission({
      actorUserId,
      actorName: session.user?.name ?? null,
      workspaceId: requestedWorkspaceId,
      action: input.action,
    });
    const auditContext =
      workspace.tenantUserId === actorUserId
        ? (auditContextForDashboardSession(session) ??
          workspaceAuditContext({
            tenantUserId: workspace.tenantUserId,
            actorUserId,
            actorEmail: session.user?.email ?? null,
          }))
        : workspaceAuditContext({
            tenantUserId: workspace.tenantUserId,
            actorUserId,
            actorEmail: session.user?.email ?? null,
          });

    return {
      tenantUserId: workspace.tenantUserId,
      actorUserId,
      workspace,
      auditContext,
    };
  } catch (error) {
    return { response: mapWorkspaceServiceError(error) };
  }
}
