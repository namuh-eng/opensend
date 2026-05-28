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
import { createReceivingRouteSchema } from "@/lib/validation/receiving-routes";
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

export async function GET(request: Request): Promise<Response> {
  const auditContext = await resolveAuditContext(request);
  if (isResponse(auditContext)) return auditContext;

  const url = new URL(request.url);
  const domainId = url.searchParams.get("domain_id");

  try {
    const result = await receivingRouteService.listRoutes({
      userId: auditContext.userId,
      domainId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to list receiving routes:", error);
    return NextResponse.json(
      { error: "Failed to list receiving routes" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const auditContext = await resolveAuditContext(request);
  if (isResponse(auditContext)) return auditContext;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = createReceivingRouteSchema.safeParse(body);
  if (!result.success) return validationResponse(result.error);

  try {
    const created = await receivingRouteService.createRoute({
      userId: auditContext.userId,
      domainId: result.data.domain_id,
      type: result.data.type,
      localPart: result.data.local_part,
      targetLocalPart: result.data.target_local_part,
    });

    await recordAuditEvent({
      context: auditContext,
      action: "receiving_route.created",
      targetType: "receiving_route",
      targetId: created.id,
      metadata: {
        domain_id: created.domain_id,
        domain: created.domain,
        type: created.type,
        local_part: created.local_part,
        target_local_part: created.target_local_part,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to create receiving route:", error);
    return NextResponse.json(
      { error: "Failed to create receiving route" },
      { status: 500 },
    );
  }
}
