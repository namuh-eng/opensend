import { randomUUID } from "node:crypto";
import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";

import { dedicatedIpPoolRepo, resolveBillingEntitlement } from "@opensend/core";

import { NextResponse } from "next/server";
import { z } from "zod";

const createPoolSchema = z.object({
  name: z.string().min(1).max(255),
  provider_pool_name: z.string().min(1).max(255).optional(),
  ses_pool_name: z.string().min(1).max(255).optional(),
  scaling_mode: z.enum(["STANDARD", "MANAGED"]).optional().default("MANAGED"),
  operator_notes: z.string().max(4000).optional(),
});

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

async function getUserPlanEntitlement(
  userId: string,
): Promise<
  | { blocked: string }
  | { dedicatedIpsEnabled: boolean; maxDedicatedIps: number }
> {
  const entitlement = await resolveBillingEntitlement(userId);
  // Self-host (billing disabled) grants the feature with no cap.
  if (entitlement.mode === "self_host") {
    return {
      dedicatedIpsEnabled: true,
      maxDedicatedIps: Number.MAX_SAFE_INTEGER,
    };
  }
  // Hosted without an active paid subscription is blocked (402 upstream).
  if (entitlement.mode === "blocked") {
    return { blocked: entitlement.reason };
  }
  return {
    dedicatedIpsEnabled: entitlement.plan.dedicatedIpsEnabled,
    maxDedicatedIps: entitlement.plan.maxDedicatedIps,
  };
}

function toDedicatedIpPoolResponse(
  pool: Awaited<ReturnType<typeof dedicatedIpPoolRepo.create>>,
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

export async function GET(req: Request) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  try {
    const pools = await dedicatedIpPoolRepo.listForUser(userId);
    return NextResponse.json({
      object: "list",
      data: pools.map(toDedicatedIpPoolResponse),
    });
  } catch (error) {
    console.error("Failed to list dedicated IP pools:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const userIdOrResponse = await resolveUserId(req);
  if (userIdOrResponse instanceof Response) return userIdOrResponse;
  const userId = userIdOrResponse;

  const planInfo = await getUserPlanEntitlement(userId);
  if ("blocked" in planInfo) {
    return NextResponse.json(
      {
        error: "An active paid subscription is required.",
        code: "payment_required",
        reason: planInfo.blocked,
      },
      { status: 402 },
    );
  }
  if (!planInfo.dedicatedIpsEnabled) {
    return NextResponse.json(
      {
        error:
          "Dedicated IP lifecycle tracking is not available on your current plan.",
        code: "plan_feature_unavailable",
      },
      { status: 403 },
    );
  }

  const currentCount = await dedicatedIpPoolRepo.countForUser(userId);
  if (currentCount >= planInfo.maxDedicatedIps) {
    return NextResponse.json(
      {
        error: `Dedicated IP pool limit reached (${planInfo.maxDedicatedIps}).`,
        code: "quota_exceeded",
      },
      { status: 402 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPoolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const providerPoolName =
    parsed.data.provider_pool_name ??
    parsed.data.ses_pool_name ??
    `manual-${randomUUID()}`;

  try {
    const pool = await dedicatedIpPoolRepo.create({
      userId,
      name: parsed.data.name,
      sesPoolName: providerPoolName,
      scalingMode: parsed.data.scaling_mode,
      status: "requested",
      provider: "manual",
      operatorNotes: parsed.data.operator_notes,
    });

    return NextResponse.json(toDedicatedIpPoolResponse(pool), { status: 201 });
  } catch (error) {
    console.error("Failed to persist dedicated IP lifecycle request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
