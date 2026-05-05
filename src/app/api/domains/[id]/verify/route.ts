import {
  authorizeDashboardOrApiKey,
  getServerSession,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import {
  getCachedDomainById,
  getCachedDomainIdentity,
  invalidateDomainCaches,
} from "@/lib/domain-cache";
import { queueEvent } from "@/lib/events";
import { verifyDomainParamsSchema } from "@/lib/validation/domains";
import { getEffectiveReturnPathLabel } from "@opensend/core";
import { and, eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await authorizeDashboardOrApiKey(
    request.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const session = "dashboard" in auth ? await getServerSession() : null;
  const userId = "userId" in auth ? auth.userId : session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const parsedParams = verifyDomainParamsSchema.safeParse(await params);
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

    const identity = await getCachedDomainIdentity(domain.name);

    let verificationStatus:
      | "pending"
      | "verified"
      | "partially_verified"
      | "failed"
      | "temporary_failure" = "pending";

    if (identity.verified) {
      verificationStatus = "verified";
    } else {
      const records =
        (domain.records as Array<{
          type: string;
          name: string;
          value: string;
          status: string;
          ttl: string;
          priority?: number;
        }>) ?? [];
      const verifiedCount = records.filter(
        (record) => record.status === "verified",
      ).length;

      if (verifiedCount > 0 && verifiedCount < records.length) {
        verificationStatus = "partially_verified";
      } else if (verifiedCount === 0 && records.length > 0) {
        verificationStatus = "pending";
      }
    }

    const previousStatus = domain.status;

    const [updated] = await db
      .update(domains)
      .set({
        status: verificationStatus,
      })
      .where(and(eq(domains.id, id), eq(domains.userId, userId)))
      .returning();

    if (!updated) {
      await invalidateDomainCaches({ id, name: domain.name });
      return Response.json({ error: "Domain not found" }, { status: 404 });
    }

    await invalidateDomainCaches({ id: updated.id, name: updated.name });

    if (updated.status !== previousStatus) {
      await queueEvent({
        type: "domain.updated",
        payload: {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          previous_status: previousStatus,
        },
      });
    }

    return Response.json({
      object: "domain",
      id: updated.id,
      name: updated.name,
      status: updated.status,
      records: updated.records || [],
      custom_return_path: updated.customReturnPath,
      return_path: getEffectiveReturnPathLabel(updated.customReturnPath),
      created_at: updated.createdAt,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to verify domain";
    return Response.json({ error: message }, { status: 500 });
  }
}
