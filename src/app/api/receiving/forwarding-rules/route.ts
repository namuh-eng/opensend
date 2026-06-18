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
import { createForwardingRuleSchema } from "@/lib/validation/forwarding-rules";
import {
  ForwardingRuleServiceError,
  createForwardingRuleService,
} from "@opensend/core";
import { NextResponse } from "next/server";

const forwardingRuleService = createForwardingRuleService();

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
  if (!(error instanceof ForwardingRuleServiceError)) return null;

  if (error.code === "route_not_found" || error.code === "rule_not_found") {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error.code === "rule_conflict") {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (
    error.code === "invalid_destinations" ||
    error.code === "loop_prevention" ||
    error.code === "invalid_status"
  ) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  return null;
}

export async function GET(request: Request): Promise<Response> {
  const auditContext = await resolveAuditContext(request);
  if (isResponse(auditContext)) return auditContext;

  const url = new URL(request.url);
  const domainId = url.searchParams.get("domain_id");

  try {
    const result = await forwardingRuleService.listRules({
      userId: auditContext.userId,
      domainId,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to list forwarding rules:", error);
    return NextResponse.json(
      { error: "Failed to list forwarding rules" },
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

  const result = createForwardingRuleSchema.safeParse(body);
  if (!result.success) return validationResponse(result.error);

  try {
    const created = await forwardingRuleService.createRule({
      userId: auditContext.userId,
      routeId: result.data.route_id,
      destinations: result.data.destinations,
      status: result.data.status,
    });

    await recordAuditEvent({
      context: auditContext,
      action: "forwarding_rule.created",
      targetType: "forwarding_rule",
      targetId: created.id,
      metadata: {
        route_id: created.route_id,
        domain_id: created.domain_id,
        destinations: created.destinations,
        status: created.status,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const mapped = mapServiceError(error);
    if (mapped) return mapped;
    console.error("Failed to create forwarding rule:", error);
    return NextResponse.json(
      { error: "Failed to create forwarding rule" },
      { status: 500 },
    );
  }
}
