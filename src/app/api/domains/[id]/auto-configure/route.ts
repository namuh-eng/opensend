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
import { configureDNSRecords } from "@/lib/cloudflare";
import { getCachedDomainById } from "@/lib/domain-cache";
import { domainRouteParamsSchema } from "@/lib/validation/domains";

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

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
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

    const syncResults = await configureDNSRecords(domain.records ?? []);

    await recordAuditEvent({
      context: auditContext,
      action: "domain.updated",
      targetType: "domain",
      targetId: domain.id,
      metadata: {
        name: domain.name,
        records: syncResults.map((record) => ({
          action: record.action,
          name: record.name,
          type: record.type,
          reason: record.reason,
        })),
      },
    });

    return Response.json({
      object: "domain",
      id: domain.id,
      name: domain.name,
      records: domain.records ?? [],
      dns_records: syncResults,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to auto-configure domain";
    return Response.json({ error: message }, { status: 500 });
  }
}
