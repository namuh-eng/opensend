// ABOUTME: Metrics API endpoint — returns aggregated email stats, daily chart data, and per-domain breakdown

import { getServerSession, unauthorizedResponse } from "@/lib/api-auth";
import {
  DASHBOARD_METRICS_CACHE_TTL_SECONDS,
  getMetricsAggregateCacheKey,
  readDashboardAggregateCache,
  writeDashboardAggregateCache,
} from "@/lib/cache/dashboard-aggregates";
import { getDateRangeBounds } from "@/lib/date-range";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

const RANGE_TO_PRESET: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_3_days: "Last 3 days",
  last_7_days: "Last 7 days",
  last_15_days: "Last 15 days",
  last_30_days: "Last 30 days",
};

// Map event type filter values to email status values
const EVENT_TYPE_TO_STATUS: Record<string, string[]> = {
  received: ["delivered", "opened", "clicked"],
  delivered: ["delivered"],
  opened: ["opened"],
  clicked: ["clicked"],
  bounced: ["bounced", "hard_bounced", "soft_bounced"],
  complained: ["complained"],
  unsubscribed: ["unsubscribed"],
  delivery_delayed: ["delivery_delayed"],
  failed: ["failed"],
  suppressed: ["suppressed"],
};

function getMetricsDateRange(range: string): { start: Date; end: Date } {
  return getDateRangeBounds(RANGE_TO_PRESET[range] || "Last 15 days");
}

const senderDomainSql = sql<string>`substring(${emails.from} from '@([^>]+)')`;

// Dashboard-only internal endpoint
export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "last_15_days";
    const domain = searchParams.get("domain");
    const eventType = searchParams.get("event_type");
    const cacheKey = getMetricsAggregateCacheKey({ range, domain, eventType });

    const cached = await readDashboardAggregateCache<unknown>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "x-opensend-cache": "hit" },
      });
    }

    const { start, end } = getMetricsDateRange(range);

    const conditions = [
      gte(emails.createdAt, start),
      lte(emails.createdAt, end),
    ];
    if (domain) {
      conditions.push(eq(senderDomainSql, domain));
    }

    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where ${emails.status} = 'delivered')::int`,
        bounced: sql<number>`count(*) filter (where ${emails.status} in ('bounced', 'hard_bounced', 'soft_bounced'))::int`,
        hard_bounced: sql<number>`count(*) filter (where ${emails.status} = 'hard_bounced')::int`,
        soft_bounced: sql<number>`count(*) filter (where ${emails.status} = 'soft_bounced')::int`,
        undetermined_bounced: sql<number>`count(*) filter (where ${emails.status} = 'bounced')::int`,
        complained: sql<number>`count(*) filter (where ${emails.status} = 'complained')::int`,
      })
      .from(emails)
      .where(and(...conditions));

    const stats = result[0] || {
      total: 0,
      delivered: 0,
      bounced: 0,
      hard_bounced: 0,
      soft_bounced: 0,
      undetermined_bounced: 0,
      complained: 0,
    };

    const totalEmails = stats.total;
    const deliverabilityRate =
      totalEmails > 0
        ? Math.round((stats.delivered / totalEmails) * 10000) / 100
        : 0;
    const bounceRate =
      totalEmails > 0
        ? Math.round((stats.bounced / totalEmails) * 10000) / 100
        : 0;
    const complainRate =
      totalEmails > 0
        ? Math.round((stats.complained / totalEmails) * 10000) / 100
        : 0;

    const dailyConditions = [...conditions];
    if (eventType && eventType !== "all" && EVENT_TYPE_TO_STATUS[eventType]) {
      const statuses = EVENT_TYPE_TO_STATUS[eventType];
      dailyConditions.push(inArray(emails.status, statuses));
    }

    const dailyRows = await db
      .select({
        date: sql<string>`to_char(${emails.createdAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(emails)
      .where(and(...dailyConditions))
      .groupBy(sql`${emails.createdAt}::date`)
      .orderBy(sql`${emails.createdAt}::date`);

    const dailyData = dailyRows.map((r) => ({
      date: r.date,
      count: r.count,
    }));

    const dailyBounceRows = await db
      .select({
        date: sql<string>`to_char(${emails.createdAt}::date, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        bounced: sql<number>`count(*) filter (where ${emails.status} in ('bounced', 'hard_bounced', 'soft_bounced'))::int`,
      })
      .from(emails)
      .where(and(...conditions))
      .groupBy(sql`${emails.createdAt}::date`)
      .orderBy(sql`${emails.createdAt}::date`);

    const dailyBounceData = dailyBounceRows.map((r) => ({
      date: r.date,
      rate: r.total > 0 ? Math.round((r.bounced / r.total) * 10000) / 100 : 0,
    }));

    const dailyComplainRows = await db
      .select({
        date: sql<string>`to_char(${emails.createdAt}::date, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        complained: sql<number>`count(*) filter (where ${emails.status} = 'complained')::int`,
      })
      .from(emails)
      .where(and(...conditions))
      .groupBy(sql`${emails.createdAt}::date`)
      .orderBy(sql`${emails.createdAt}::date`);

    const dailyComplainData = dailyComplainRows.map((r) => ({
      date: r.date,
      rate:
        r.total > 0 ? Math.round((r.complained / r.total) * 10000) / 100 : 0,
    }));

    const domainBreakdownRows = await db
      .select({
        domain: senderDomainSql,
        total: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where ${emails.status} = 'delivered')::int`,
      })
      .from(emails)
      .where(and(...conditions))
      .groupBy(senderDomainSql)
      .orderBy(sql`count(*) desc`);

    const domainBreakdown = domainBreakdownRows
      .filter((r) => r.domain !== null && r.domain !== "")
      .map((r) => ({
        domain: r.domain,
        count: r.total,
        rate:
          r.total > 0 ? Math.round((r.delivered / r.total) * 10000) / 100 : 0,
      }));

    const payload = {
      totalEmails,
      deliverabilityRate,
      bounceRate,
      complainRate,
      domains: domainBreakdown.map((d) => d.domain),
      dailyData,
      domainBreakdown,
      bounceBreakdown: {
        permanent: stats.hard_bounced,
        transient: stats.soft_bounced,
        undetermined: stats.undetermined_bounced,
      },
      dailyBounceData,
      complained: stats.complained,
      dailyComplainData,
      lastUpdated: new Date().toISOString(),
    };

    await writeDashboardAggregateCache(
      cacheKey,
      payload,
      DASHBOARD_METRICS_CACHE_TTL_SECONDS,
    );

    return NextResponse.json(payload, {
      headers: { "x-opensend-cache": "miss" },
    });
  } catch (error) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics data" },
      { status: 500 },
    );
  }
}
