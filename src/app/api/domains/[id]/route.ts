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
  recordAuditEvent,
} from "@/lib/audit-events";
import { deleteDNSRecord, listDNSRecords } from "@/lib/cloudflare";
import {
  getCachedDomainById,
  invalidateDomainCaches,
} from "@/lib/domain-cache";
import { queueEvent } from "@/lib/events";
import { deleteDomainIdentity } from "@/lib/ses";
import {
  domainRouteParamsSchema,
  updateDomainSchema,
} from "@/lib/validation/domains";
import {
  DomainDetailServiceError,
  createDomainDetailService,
} from "@opensend/core";
import { NextResponse } from "next/server";

function domainDetailService() {
  return createDomainDetailService({
    getDomainById: getCachedDomainById,
    deleteDomainIdentity,
    listDNSRecords,
    deleteDNSRecord,
    invalidateDomainCaches,
  });
}

async function resolveAuditContext(
  request: Request,
): Promise<AuditContext | Response> {
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

  return auditContext;
}

function isResponse(value: AuditContext | Response): value is Response {
  return value instanceof Response;
}

function validationResponse(error: { flatten: () => unknown }) {
  return NextResponse.json(
    { error: "Validation failed", details: error.flatten() },
    { status: 422 },
  );
}

function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function internalErrorResponse() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auditContext = await resolveAuditContext(req);
  if (isResponse(auditContext)) return auditContext;
  const userId = auditContext.userId;

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationResponse(parsedParams.error);
  }

  try {
    const domain = await domainDetailService().getDomainDetail({
      id: parsedParams.data.id,
      userId,
    });

    return NextResponse.json(domain);
  } catch (error) {
    if (
      error instanceof DomainDetailServiceError &&
      error.code === "not_found"
    ) {
      return notFoundResponse();
    }

    console.error("Failed to retrieve domain:", error);
    return internalErrorResponse();
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auditContext = await resolveAuditContext(req);
  if (isResponse(auditContext)) return auditContext;
  const userId = auditContext.userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updateDomainSchema.safeParse(body);
  if (!result.success) {
    return validationResponse(result.error);
  }

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationResponse(parsedParams.error);
  }

  try {
    const updated = await domainDetailService().updateDomainDetail({
      id: parsedParams.data.id,
      userId,
      updates: result.data,
    });

    if (updated.eventPayload) {
      await queueEvent({
        type: "domain.updated",
        userId,
        payload: updated.eventPayload,
      });

      await recordAuditEvent({
        context: auditContext,
        action: "domain.updated",
        targetType: "domain",
        targetId: updated.response.id,
        metadata: {
          changed_fields: updated.changedFields,
          updates: result.data,
        },
      });
    }

    return NextResponse.json(updated.response);
  } catch (error) {
    if (
      error instanceof DomainDetailServiceError &&
      error.code === "not_found"
    ) {
      return notFoundResponse();
    }

    console.error("Failed to update domain:", error);
    return internalErrorResponse();
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auditContext = await resolveAuditContext(req);
  if (isResponse(auditContext)) return auditContext;
  const userId = auditContext.userId;

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationResponse(parsedParams.error);
  }

  try {
    const deleted = await domainDetailService().deleteDomainDetail({
      id: parsedParams.data.id,
      userId,
    });

    await queueEvent({
      type: "domain.deleted",
      userId,
      payload: deleted.eventPayload,
    });

    await recordAuditEvent({
      context: auditContext,
      action: "domain.deleted",
      targetType: "domain",
      targetId: deleted.response.id,
      metadata: {
        name: deleted.eventPayload.name,
      },
    });

    return NextResponse.json(deleted.response);
  } catch (error) {
    if (
      error instanceof DomainDetailServiceError &&
      error.code === "not_found"
    ) {
      return notFoundResponse();
    }

    console.error("Failed to delete domain:", error);
    return internalErrorResponse();
  }
}
