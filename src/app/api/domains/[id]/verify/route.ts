import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import {
  auditContextForApiKey,
  auditContextForDashboardSession,
  recordAuditEvent,
} from "@/lib/audit-events";
import {
  getCachedDomainById,
  invalidateDomainCaches,
} from "@/lib/domain-cache";
import { queueEvent } from "@/lib/events";
import { verifyDomainParamsSchema } from "@/lib/validation/domains";
import {
  createDomainService,
  getEffectiveReturnPathLabel,
} from "@opensend/core";

const domainService = createDomainService({ invalidateDomainCaches });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  const session = "dashboard" in auth ? await getServerSession() : null;
  const auditContext =
    "userId" in auth
      ? auth.userId
        ? auditContextForApiKey({
            userId: auth.userId,
            apiKeyId: auth.apiKeyId,
          })
        : null
      : auditContextForDashboardSession(session);
  if (!auditContext) return unauthorizedResponse();
  const userId = auditContext.userId;

  const parsedParams = verifyDomainParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return Response.json(
      { error: "Validation failed", details: parsedParams.error.flatten() },
      { status: 422 },
    );
  }

  const { id } = parsedParams.data;

  try {
    const domain = await getCachedDomainById(id);

    if (!domain || domain.userId !== userId) {
      return Response.json({ error: "Domain not found" }, { status: 404 });
    }

    // Cache invalidation is owned by the service. Do not re-add a route-layer call.
    const result = await domainService.reconcileVerification(id);

    if (result.status === "not_found") {
      return Response.json({ error: "Domain not found" }, { status: 404 });
    }

    const reconciled = result.domain;

    if (result.status === "updated") {
      await queueEvent({
        type: "domain.updated",
        userId,
        payload: {
          id: reconciled.id,
          name: reconciled.name,
          status: reconciled.status,
          previous_status: result.previousStatus,
          records: reconciled.records || [],
          capabilities: reconciled.capabilities || [],
        },
      });
    }

    await recordAuditEvent({
      context: auditContext,
      action: "domain.verified",
      targetType: "domain",
      targetId: reconciled.id,
      metadata: {
        name: reconciled.name,
        previous_status:
          result.status === "updated"
            ? result.previousStatus
            : reconciled.status,
        status: reconciled.status,
        result: result.status,
      },
    });

    return Response.json({
      object: "domain",
      id: reconciled.id,
      name: reconciled.name,
      status: reconciled.status,
      records: reconciled.records || [],
      custom_return_path: reconciled.customReturnPath,
      return_path: getEffectiveReturnPathLabel(reconciled.customReturnPath),
      created_at: reconciled.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to verify domain";
    return Response.json({ error: message }, { status: 500 });
  }
}
