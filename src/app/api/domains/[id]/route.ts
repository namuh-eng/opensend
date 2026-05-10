import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
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

async function resolveUserId(request: Request): Promise<string | Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();
  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  return userId;
}

function isResponse(value: string | Response): value is Response {
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
  const userId = await resolveUserId(req);
  if (isResponse(userId)) return userId;

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
  const userId = await resolveUserId(req);
  if (isResponse(userId)) return userId;

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
  const userId = await resolveUserId(req);
  if (isResponse(userId)) return userId;

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
