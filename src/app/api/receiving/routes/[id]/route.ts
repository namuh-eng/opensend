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
import {
  receivingRouteParamsSchema,
  updateReceivingRouteSchema,
} from "@/lib/validation/receiving-routes";
import {
  ReceivingRouteServiceError,
  createReceivingRouteService,
} from "@opensend/core";
import { NextResponse } from "next/server";

const receivingRouteService = createReceivingRouteService();

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

function mapServiceError(error: unknown): Response | null {
  if (!(error instanceof ReceivingRouteServiceError)) return null;

  if (error.code === "domain_not_found" || error.code === "route_not_found") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.code === "domain_not_ready") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error.code === "invalid_route") {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error.code === "route_conflict") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auditContext = await resolveAuditContext(request);
  if (isResponse(auditContext)) return auditContext;

  const parsedParams = receivingRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) return validationResponse(parsedParams.error);

  try {
    const result = await receivingRouteService.getRoute(
      parsedParams.data.id,
      auditContext.userId,
    );
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to retrieve receiving route:", error);
    return NextResponse.json(
      { error: "Failed to retrieve receiving route" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auditContext = await resolveAuditContext(request);
  if (isResponse(auditContext)) return auditContext;

  const parsedParams = receivingRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) return validationResponse(parsedParams.error);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updateReceivingRouteSchema.safeParse(body);
  if (!result.success) return validationResponse(result.error);

  try {
    const updated = await receivingRouteService.updateRoute({
      id: parsedParams.data.id,
      userId: auditContext.userId,
      localPart: result.data.local_part,
      targetLocalPart: result.data.target_local_part,
    });

    await recordAuditEvent({
      context: auditContext,
      action: "receiving_route.updated",
      targetType: "receiving_route",
      targetId: updated.id,
      metadata: {
        domain_id: updated.domain_id,
        domain: updated.domain,
        type: updated.type,
        local_part: updated.local_part,
        target_local_part: updated.target_local_part,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to update receiving route:", error);
    return NextResponse.json(
      { error: "Failed to update receiving route" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auditContext = await resolveAuditContext(request);
  if (isResponse(auditContext)) return auditContext;

  const parsedParams = receivingRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) return validationResponse(parsedParams.error);

  try {
    const deleted = await receivingRouteService.deleteRoute(
      parsedParams.data.id,
      auditContext.userId,
    );

    await recordAuditEvent({
      context: auditContext,
      action: "receiving_route.deleted",
      targetType: "receiving_route",
      targetId: deleted.id,
    });

    return NextResponse.json(deleted);
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to delete receiving route:", error);
    return NextResponse.json(
      { error: "Failed to delete receiving route" },
      { status: 500 },
    );
  }
}
