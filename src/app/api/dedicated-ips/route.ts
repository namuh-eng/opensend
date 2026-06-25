import { randomUUID } from "node:crypto";
import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { requireFullAccessForApiKeyCaller } from "@/lib/api-key-permissions";
import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { dedicatedIpPoolRepo } from "@opensend/core";
import { eq } from "drizzle-orm";
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

async function getUserPlan(
  userId: string,
): Promise<{ dedicatedIpsEnabled: boolean; maxDedicatedIps: number } | null> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (sub) {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, sub.planId),
    });
    if (plan) {
      return {
        dedicatedIpsEnabled: plan.dedicatedIpsEnabled,
        maxDedicatedIps: plan.maxDedicatedIps,
      };
    }
  }

  return { dedicatedIpsEnabled: false, maxDedicatedIps: 0 };
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

  const planInfo = await getUserPlan(userId);
  if (!planInfo?.dedicatedIpsEnabled) {
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
