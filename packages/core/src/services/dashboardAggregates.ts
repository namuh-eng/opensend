import { type SQL, and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { contacts, domains, emails, segments } from "../db/schema";
import { FREE_PLAN_DEFAULTS } from "../dto";

// Fallback display limits for installations without an active billing summary.
// Keep plan-backed values tied to FREE_PLAN_DEFAULTS so the fallback cannot
// drift from the Free plan rows created by quota enforcement and planRepo.
export const DASHBOARD_USAGE_LIMITS = {
  transactional: {
    monthlyLimit: FREE_PLAN_DEFAULTS.monthlyEmailQuota,
    dailyLimit: 100,
  },
  marketing: {
    contactsLimit: 1000,
    segmentsLimit: 3,
    broadcastsLimit: "Unlimited",
  },
  team: {
    domainsLimit: FREE_PLAN_DEFAULTS.maxDomains,
    rateLimit: 2,
  },
} as const;

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

const senderDomainSql = sql<string>`substring(${emails.from} from '@([^>]+)')`;

export type DashboardMetricsStats = {
  total: number;
  delivered: number;
  bounced: number;
  hard_bounced: number;
  soft_bounced: number;
  undetermined_bounced: number;
  complained: number;
};

export type DashboardDailyCountRow = {
  date: string;
  count: number;
};

export type DashboardDailyBounceRow = {
  date: string;
  total: number;
  bounced: number;
};

export type DashboardDailyComplainRow = {
  date: string;
  total: number;
  complained: number;
};

export type DashboardDomainBreakdownRow = {
  domain: string | null;
  total: number;
  delivered: number;
};

export type DashboardMetricsBaseInput = {
  userId: string;
  start: Date;
  end: Date;
  domain: string | null;
};

export type DashboardDailyCountsInput = DashboardMetricsBaseInput & {
  statuses?: string[];
};

export type DashboardUsageCountInput = {
  startOfMonth: Date;
  startOfDay: Date;
};

export type DashboardUsageCounts = {
  monthlyEmails: number;
  dailyEmails: number;
  contacts: number;
  segments: number;
  domains: number;
};

export type DashboardAggregateRepository = {
  aggregateMetrics(
    input: DashboardMetricsBaseInput,
  ): Promise<DashboardMetricsStats>;
  listDailyCounts(
    input: DashboardDailyCountsInput,
  ): Promise<DashboardDailyCountRow[]>;
  listDailyBounceRates(
    input: DashboardMetricsBaseInput,
  ): Promise<DashboardDailyBounceRow[]>;
  listDailyComplainRates(
    input: DashboardMetricsBaseInput,
  ): Promise<DashboardDailyComplainRow[]>;
  listDomainBreakdown(
    input: DashboardMetricsBaseInput,
  ): Promise<DashboardDomainBreakdownRow[]>;
  countUsage(input: DashboardUsageCountInput): Promise<DashboardUsageCounts>;
};

export type DashboardAggregateServiceDependencies = {
  repository?: DashboardAggregateRepository;
};

export type GetDashboardMetricsInput = DashboardMetricsBaseInput & {
  eventType: string | null;
  now?: Date;
};

export type DashboardMetricsPayload = {
  totalEmails: number;
  deliverabilityRate: number;
  bounceRate: number;
  complainRate: number;
  domains: string[];
  dailyData: DashboardDailyCountRow[];
  domainBreakdown: Array<{
    domain: string;
    count: number;
    rate: number;
  }>;
  bounceBreakdown: {
    permanent: number;
    transient: number;
    undetermined: number;
  };
  dailyBounceData: Array<{
    date: string;
    rate: number;
  }>;
  complained: number;
  dailyComplainData: Array<{
    date: string;
    rate: number;
  }>;
  lastUpdated: string;
};

export type DashboardUsagePayload = {
  plan: {
    name: string;
    slug: string;
  };
  transactional: {
    monthlyUsed: number;
    monthlyLimit: number;
    dailyUsed: number;
    dailyLimit: number;
  };
  marketing: {
    contactsUsed: number;
    contactsLimit: number;
    segmentsUsed: number;
    segmentsLimit: number;
    broadcastsLimit: typeof DASHBOARD_USAGE_LIMITS.marketing.broadcastsLimit;
  };
  team: {
    domainsUsed: number;
    domainsLimit: number;
    rateLimit: number;
  };
};

function metricConditions(input: DashboardMetricsBaseInput): SQL<unknown>[] {
  const conditions: SQL<unknown>[] = [
    eq(emails.userId, input.userId),
    gte(emails.createdAt, input.start),
    lte(emails.createdAt, input.end),
  ];

  if (input.domain) {
    conditions.push(eq(senderDomainSql, input.domain));
  }

  return conditions;
}

const emptyMetricsStats: DashboardMetricsStats = {
  total: 0,
  delivered: 0,
  bounced: 0,
  hard_bounced: 0,
  soft_bounced: 0,
  undetermined_bounced: 0,
  complained: 0,
};

const defaultDashboardAggregateRepository: DashboardAggregateRepository = {
  async aggregateMetrics(input) {
    const [stats] = await db
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
      .where(and(...metricConditions(input)));

    return stats ?? emptyMetricsStats;
  },

  async listDailyCounts(input) {
    const conditions = metricConditions(input);
    if (input.statuses && input.statuses.length > 0) {
      conditions.push(inArray(emails.status, input.statuses));
    }

    return await db
      .select({
        date: sql<string>`to_char(${emails.createdAt}::date, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(emails)
      .where(and(...conditions))
      .groupBy(sql`${emails.createdAt}::date`)
      .orderBy(sql`${emails.createdAt}::date`);
  },

  async listDailyBounceRates(input) {
    return await db
      .select({
        date: sql<string>`to_char(${emails.createdAt}::date, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        bounced: sql<number>`count(*) filter (where ${emails.status} in ('bounced', 'hard_bounced', 'soft_bounced'))::int`,
      })
      .from(emails)
      .where(and(...metricConditions(input)))
      .groupBy(sql`${emails.createdAt}::date`)
      .orderBy(sql`${emails.createdAt}::date`);
  },

  async listDailyComplainRates(input) {
    return await db
      .select({
        date: sql<string>`to_char(${emails.createdAt}::date, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        complained: sql<number>`count(*) filter (where ${emails.status} = 'complained')::int`,
      })
      .from(emails)
      .where(and(...metricConditions(input)))
      .groupBy(sql`${emails.createdAt}::date`)
      .orderBy(sql`${emails.createdAt}::date`);
  },

  async listDomainBreakdown(input) {
    return await db
      .select({
        domain: senderDomainSql,
        total: sql<number>`count(*)::int`,
        delivered: sql<number>`count(*) filter (where ${emails.status} = 'delivered')::int`,
      })
      .from(emails)
      .where(and(...metricConditions(input)))
      .groupBy(senderDomainSql)
      .orderBy(sql`count(*) desc`);
  },

  async countUsage(input) {
    const [
      monthlyEmails,
      dailyEmails,
      contactCount,
      segmentCount,
      domainCount,
    ] = await Promise.all([
      db.$count(emails, gte(emails.createdAt, input.startOfMonth)),
      db.$count(emails, gte(emails.createdAt, input.startOfDay)),
      db.$count(contacts),
      db.$count(segments),
      db.$count(domains),
    ]);

    return {
      monthlyEmails: Number(monthlyEmails),
      dailyEmails: Number(dailyEmails),
      contacts: Number(contactCount),
      segments: Number(segmentCount),
      domains: Number(domainCount),
    };
  },
};

function roundRate(numerator: number, denominator: number): number {
  return denominator > 0
    ? Math.round((numerator / denominator) * 10000) / 100
    : 0;
}

function getEventStatuses(eventType: string | null): string[] | undefined {
  if (!eventType || eventType === "all") return undefined;
  return EVENT_TYPE_TO_STATUS[eventType];
}

function getUsageBounds(now: Date): DashboardUsageCountInput {
  return {
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    startOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

export function createDashboardAggregateService({
  repository = defaultDashboardAggregateRepository,
}: DashboardAggregateServiceDependencies = {}) {
  return {
    async getMetrics(
      input: GetDashboardMetricsInput,
    ): Promise<DashboardMetricsPayload> {
      const baseInput: DashboardMetricsBaseInput = {
        userId: input.userId,
        start: input.start,
        end: input.end,
        domain: input.domain,
      };
      const [stats, dailyRows, dailyBounceRows, dailyComplainRows, domainRows] =
        await Promise.all([
          repository.aggregateMetrics(baseInput),
          repository.listDailyCounts({
            ...baseInput,
            statuses: getEventStatuses(input.eventType),
          }),
          repository.listDailyBounceRates(baseInput),
          repository.listDailyComplainRates(baseInput),
          repository.listDomainBreakdown(baseInput),
        ]);

      const totalEmails = stats.total;
      const domainBreakdown = domainRows
        .filter(
          (row): row is DashboardDomainBreakdownRow & { domain: string } =>
            row.domain !== null && row.domain !== "",
        )
        .map((row) => ({
          domain: row.domain,
          count: row.total,
          rate: roundRate(row.delivered, row.total),
        }));

      return {
        totalEmails,
        deliverabilityRate: roundRate(stats.delivered, totalEmails),
        bounceRate: roundRate(stats.bounced, totalEmails),
        complainRate: roundRate(stats.complained, totalEmails),
        domains: domainBreakdown.map((item) => item.domain),
        dailyData: dailyRows.map((row) => ({
          date: row.date,
          count: row.count,
        })),
        domainBreakdown,
        bounceBreakdown: {
          permanent: stats.hard_bounced,
          transient: stats.soft_bounced,
          undetermined: stats.undetermined_bounced,
        },
        dailyBounceData: dailyBounceRows.map((row) => ({
          date: row.date,
          rate: roundRate(row.bounced, row.total),
        })),
        complained: stats.complained,
        dailyComplainData: dailyComplainRows.map((row) => ({
          date: row.date,
          rate: roundRate(row.complained, row.total),
        })),
        lastUpdated: (input.now ?? new Date()).toISOString(),
      };
    },

    async getUsage(now = new Date()): Promise<DashboardUsagePayload> {
      const counts = await repository.countUsage(getUsageBounds(now));

      return {
        plan: {
          name: FREE_PLAN_DEFAULTS.name,
          slug: FREE_PLAN_DEFAULTS.slug,
        },
        transactional: {
          monthlyUsed: counts.monthlyEmails,
          monthlyLimit: DASHBOARD_USAGE_LIMITS.transactional.monthlyLimit,
          dailyUsed: counts.dailyEmails,
          dailyLimit: DASHBOARD_USAGE_LIMITS.transactional.dailyLimit,
        },
        marketing: {
          contactsUsed: counts.contacts,
          contactsLimit: DASHBOARD_USAGE_LIMITS.marketing.contactsLimit,
          segmentsUsed: counts.segments,
          segmentsLimit: DASHBOARD_USAGE_LIMITS.marketing.segmentsLimit,
          broadcastsLimit: DASHBOARD_USAGE_LIMITS.marketing.broadcastsLimit,
        },
        team: {
          domainsUsed: counts.domains,
          domainsLimit: DASHBOARD_USAGE_LIMITS.team.domainsLimit,
          rateLimit: DASHBOARD_USAGE_LIMITS.team.rateLimit,
        },
      };
    },
  };
}

export const dashboardAggregateService = createDashboardAggregateService();
