import {
  approveAndProvisionPool,
  type dedicatedIpPoolRepo,
  timingSafeStringEqual,
} from "@opensend/core";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/internal/dedicated-ips/[id]/approve
 *
 * Operator-only endpoint for approving and provisioning a dedicated IP pool
 * via SES. Requires the DEDICATED_IP_OPERATOR_TOKEN header.
 *
 * This is the only path that calls SES CreateDedicatedIpPool.
 * SES MANAGED pools accrue AWS charges from the moment this endpoint fires.
 * Only call after explicit operator review.
 */

const approveBodySchema = z.object({
  aws_region: z.string().min(1).max(32).optional(),
  operator_notes: z.string().max(4000).optional(),
});

function toDedicatedIpPoolResponse(
  pool: NonNullable<Awaited<ReturnType<typeof dedicatedIpPoolRepo.findById>>>,
) {
  return {
    object: "dedicated_ip_pool",
    id: pool.id,
    name: pool.name,
    provider: pool.provider,
    provider_pool_name: pool.sesPoolName.startsWith("manual-")
      ? null
      : pool.sesPoolName,
    ses_pool_name: pool.sesPoolName,
    scaling_mode: pool.scalingMode,
    status: pool.status,
    operator_notes: pool.operatorNotes,
    ip_count: pool.ipCount ?? null,
    aws_region: pool.awsRegion ?? null,
    provisioned_at: pool.provisionedAt,
    warming_started_at: pool.warmingStartedAt,
    retired_at: pool.retiredAt,
    created_at: pool.createdAt,
    updated_at: pool.updatedAt,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.DEDICATED_IP_OPERATOR_TOKEN;

  if (
    !expectedToken ||
    !timingSafeStringEqual(authHeader, `Bearer ${expectedToken}`)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = approveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await approveAndProvisionPool(id, {
      awsRegion: parsed.data.aws_region,
      operatorNotes: parsed.data.operator_notes,
    });

    if (!result.ok) {
      if (result.code === "not_found") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (result.code === "invalid_status") {
        return NextResponse.json(
          {
            error: "Pool is not in requested status",
            current_status: result.current,
          },
          { status: 409 },
        );
      }
    }

    if (result.ok) {
      return NextResponse.json({
        ...toDedicatedIpPoolResponse(result.pool),
        volume_warning: result.volumeWarning,
        emails_sent: result.emailsSent,
      });
    }

    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  } catch (err) {
    console.error("dedicated_ip.approve.failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
