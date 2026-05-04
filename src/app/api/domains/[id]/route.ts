import {
  authorizeDashboardOrApiKey,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { deleteDNSRecord, listDNSRecords } from "@/lib/cloudflare";
import { db } from "@/lib/db";
import { domains } from "@/lib/db/schema";
import {
  getCachedDomainById,
  invalidateDomainCaches,
} from "@/lib/domain-cache";
import { deleteDomainIdentity } from "@/lib/ses";
import {
  domainRouteParamsSchema,
  updateDomainSchema,
} from "@/lib/validation/domains";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const defaultCapabilities = [
  { name: "sending", enabled: true },
  { name: "receiving", enabled: false },
];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeDashboardOrApiKey(
    _req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedParams.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const { id } = parsedParams.data;
    const domain = await getCachedDomainById(id);

    if (!domain) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      object: "domain",
      id: domain.id,
      name: domain.name,
      status: domain.status,
      region: domain.region,
      records: domain.records || [],
      open_tracking: domain.trackOpens,
      click_tracking: domain.trackClicks,
      tracking_subdomain: domain.trackingSubdomain,
      tls: domain.tls,
      capabilities: domain.capabilities,
      created_at: domain.createdAt,
    });
  } catch (error) {
    console.error("Failed to retrieve domain:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeDashboardOrApiKey(
    req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = updateDomainSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten() },
      { status: 422 },
    );
  }

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedParams.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const { id } = parsedParams.data;
    const validated = result.data;
    const updates: Record<string, unknown> = {};
    const existingDomain = await getCachedDomainById(id);

    if (!existingDomain) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (validated.click_tracking !== undefined) {
      updates.trackClicks = validated.click_tracking;
    }
    if (validated.open_tracking !== undefined) {
      updates.trackOpens = validated.open_tracking;
    }
    if (validated.tracking_subdomain !== undefined) {
      updates.trackingSubdomain = validated.tracking_subdomain;
    }

    if (validated.capabilities !== undefined) {
      updates.capabilities = validated.capabilities;
    } else if (
      validated.sending_enabled !== undefined ||
      validated.receiving_enabled !== undefined
    ) {
      const currentCaps = existingDomain.capabilities || defaultCapabilities;
      const newCaps = currentCaps.map((cap) => {
        if (cap.name === "sending" && validated.sending_enabled !== undefined) {
          return { ...cap, enabled: validated.sending_enabled };
        }
        if (
          cap.name === "receiving" &&
          validated.receiving_enabled !== undefined
        ) {
          return { ...cap, enabled: validated.receiving_enabled };
        }
        return cap;
      });
      updates.capabilities = newCaps;
    }

    if (validated.tls !== undefined) {
      updates.tls = validated.tls;
    }

    const [updated] = await db
      .update(domains)
      .set(updates)
      .where(eq(domains.id, id))
      .returning();

    if (!updated) {
      await invalidateDomainCaches({ id, name: existingDomain.name });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await invalidateDomainCaches({ id: updated.id, name: updated.name });

    return NextResponse.json({
      object: "domain",
      id: updated.id,
    });
  } catch (error) {
    console.error("Failed to update domain:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeDashboardOrApiKey(
    _req.headers.get("authorization"),
  );
  if (!auth) return unauthorizedResponse();

  const parsedParams = domainRouteParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsedParams.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const { id } = parsedParams.data;
    const domain = await getCachedDomainById(id);

    if (!domain) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
      await deleteDomainIdentity(domain.name);
    } catch (sesErr) {
      console.warn(`Failed to delete SES identity for ${domain.name}:`, sesErr);
    }

    try {
      const records = await listDNSRecords({ name: domain.name });
      const sesRecords = records.filter(
        (record) =>
          record.content.includes("amazonses.com") ||
          record.name.includes("_domainkey") ||
          record.content.startsWith("v=spf1"),
      );

      await Promise.all(sesRecords.map((record) => deleteDNSRecord(record.id)));
    } catch (cfErr) {
      console.warn(
        `Failed to cleanup Cloudflare records for ${domain.name}:`,
        cfErr,
      );
    }

    const [deleted] = await db
      .delete(domains)
      .where(eq(domains.id, id))
      .returning({ id: domains.id });

    await invalidateDomainCaches({ id, name: domain.name });

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      object: "domain",
      id: deleted.id,
      deleted: true,
    });
  } catch (error) {
    console.error("Failed to delete domain:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
