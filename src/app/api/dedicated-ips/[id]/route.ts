import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { configurationSetService, dedicatedIpPoolRepo } from "@opensend/core";
import { NextResponse } from "next/server";

async function resolveUserId(req: Request): Promise<string | Response> {
  const auth = await authorizeDashboardOrApiKey(
    req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const permissionError = requireFullAccessForApiKeyCaller(auth);
  if (permissionError) return permissionError;

  if ("dashboard" in auth) {
    const session = await getServerSession();
    if (!session?.user?.id) return unauthorizedResponse();
    return session.user.id;
  }

  if ("userId" in auth && auth.userId) {
    return auth.userId;
  }

  return unauthorizedResponse();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  const { id } = await params;

  const pool = await dedicatedIpPoolRepo.findByIdForUser(id, userId);
  if (!pool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    object: "dedicated_ip_pool",
    id: pool.id,
    name: pool.name,
    ses_pool_name: pool.sesPoolName,
    scaling_mode: pool.scalingMode,
    status: pool.status,
    created_at: pool.createdAt,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  const { id } = await params;

  const pool = await dedicatedIpPoolRepo.findByIdForUser(id, userId);
  if (!pool) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from SES first (best-effort)
  try {
    await configurationSetService.deleteDedicatedIpPool({
      poolName: pool.sesPoolName,
    });
  } catch (err) {
    console.warn(
      `Failed to delete SES pool ${pool.sesPoolName} — continuing with DB delete:`,
      err,
    );
  }

  await dedicatedIpPoolRepo.deleteForUser(id, userId);

  return NextResponse.json({ object: "dedicated_ip_pool", id, deleted: true });
}
