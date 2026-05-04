import { unauthorizedResponse, validateApiKey } from "@/lib/api-auth";
import {
  BROADCAST_METRICS_CACHE_TTL_SECONDS,
  getBroadcastMetricsCacheKey,
  readDashboardAggregateCache,
  writeDashboardAggregateCache,
} from "@/lib/cache/dashboard-aggregates";
import { db } from "@/lib/db";
import { broadcasts, emails } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateApiKey(request.headers.get("authorization"));
  if (!auth) return unauthorizedResponse();

  try {
    const { id } = await params;
    const cacheKey = getBroadcastMetricsCacheKey(id);

    const cached = await readDashboardAggregateCache<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "x-opensend-cache": "hit" },
      });
    }

    const [broadcast] = await db
      .select({ id: broadcasts.id })
      .from(broadcasts)
      .where(eq(broadcasts.id, id))
      .limit(1);

    if (!broadcast) {
      return NextResponse.json(
        { error: "Broadcast not found" },
        { status: 404 },
      );
    }

    const condition = sql`${emails.tags} @> ${[{ name: "broadcast_id", value: id }]}`;

    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where ${emails.status} = 'delivered')::int`,
        bounced: sql<number>`count(*) filter (where ${emails.status} in ('bounced', 'hard_bounced', 'soft_bounced'))::int`,
        complained: sql<number>`count(*) filter (where ${emails.status} = 'complained')::int`,
        opened: sql<number>`count(*) filter (where ${emails.status} = 'opened')::int`,
        clicked: sql<number>`count(*) filter (where ${emails.status} = 'clicked')::int`,
      })
      .from(emails)
      .where(condition);

    const stats = result[0] || {
      total: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      opened: 0,
      clicked: 0,
    };

    const total = stats.total;

    const payload = {
      object: "broadcast_metrics",
      broadcast_id: id,
      total,
      delivered: stats.delivered,
      bounced: stats.bounced,
      complained: stats.complained,
      opened: stats.opened,
      clicked: stats.clicked,
      delivery_rate: total > 0 ? (stats.delivered / total) * 100 : 0,
      open_rate: total > 0 ? (stats.opened / total) * 100 : 0,
      click_rate: total > 0 ? (stats.clicked / total) * 100 : 0,
      bounce_rate: total > 0 ? (stats.bounced / total) * 100 : 0,
    };

    await writeDashboardAggregateCache(
      cacheKey,
      payload,
      BROADCAST_METRICS_CACHE_TTL_SECONDS,
    );

    return NextResponse.json(payload, {
      headers: { "x-opensend-cache": "miss" },
    });
  } catch (error) {
    console.error("Failed to fetch broadcast metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch broadcast metrics" },
      { status: 500 },
    );
  }
}
