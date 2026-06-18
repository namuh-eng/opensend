import { type SQL, and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  contacts,
  domains,
  emailEvents,
  emails,
  plans,
  segments,
} from "../db/schema";
import { FREE_PLAN_DEFAULTS, FREE_PLAN_SLUG } from "../dto";

// Last-resort fallback used only when the plans table is empty (cold start
// before ensureFreePlan has run). All real values live on the Free plan row.
export const DASHBOARD_USAGE_LIMITS = {
  transactional: {
    monthlyLimit: FREE_PLAN_DEFAULTS.monthlyEmailQuota,
    dailyLimit: FREE_PLAN_DEFAULTS.dailyEmailQuota,
  },
  marketing: {
    contactsLimit: FREE_PLAN_DEFAULTS.maxContacts,
    segmentsLimit: FREE_PLAN_DEFAULTS.maxSegments,
    broadcastsLimit: FREE_PLAN_DEFAULTS.maxBroadcasts as number | null,
  },
  team: {
    domainsLimit: FREE_PLAN_DEFAULTS.maxDomains,
    rateLimit: FREE_PLAN_DEFAULTS.ratePerSecond,
  },
} as const;

export type PlanUsageLimits = {
  name: string;
  slug: string;
  monthlyEmailQuota: number;
  dailyEmailQuota: number;
  maxDomains: number;
  maxContacts: number;
  maxSegments: number;
  maxBroadcasts: number | null;
  ratePerSecond: number;
};

async function defaultLoadPlanLimits(): Promise<PlanUsageLimits | null> {
  try {
    const row = await db.query.plans.findFirst({
      where: eq(plans.slug, FREE_PLAN_SLUG),
    });
    if (!row) return null;
    return {
      name: row.name,
      slug: row.slug,
      monthlyEmailQuota: row.monthlyEmailQuota,
      dailyEmailQuota: row.dailyEmailQuota,
      maxDomains: row.maxDomains,
      maxContacts: row.maxContacts,
      maxSegments: row.maxSegments,
      maxBroadcasts: row.maxBroadcasts,
      ratePerSecond: row.ratePerSecond,
    };
  } catch {
    return null;
  }
}

const EVENT_TYPE_TO_EVENT_TYPES: Record<string, string[]> = {
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

function emailEventExists(eventTypes: string[]): SQL<unknown> {
  return sql`exists (
    select 1
    from ${emailEvents}
    where ${emailEvents.emailId} = ${emails.id}
      and ${inArray(emailEvents.type, eventTypes)}
  )`;
}

function bouncedEmailEventExists(extraCondition?: SQL<unknown>): SQL<unknown> {
  return sql`exists (
    select 1
    from ${emailEvents}
    where ${emailEvents.emailId} = ${emails.id}
      and ${emailEvents.type} = 'bounced'
      ${extraCondition ? sql`and ${extraCondition}` : sql``}
  )`;
}

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

export type DashboardTagOption = {
  name: string;
  values: string[];
};

export type DashboardTagBreakdownRow = {
  name: string;
  value: string;
  total: number;
  delivered: number;
};

export type DashboardStoredEmailTag = {
  name: string;
  value: string;
};

export type DashboardMetricsBaseInput = {
  userId: string;
  start: Date;
  end: Date;
  domain: string | null;
  tagName: string | null;
  tagValue: string | null;
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
  listTagBreakdown(
    input: DashboardMetricsBaseInput,
  ): Promise<DashboardTagBreakdownRow[]>;
  listTagOptions(
    input: DashboardMetricsBaseInput,
  ): Promise<DashboardTagOption[]>;
  countUsage(input: DashboardUsageCountInput): Promise<DashboardUsageCounts>;
};

export type DashboardAggregateServiceDependencies = {
  repository?: DashboardAggregateRepository;
  loadPlanLimits?: () => Promise<PlanUsageLimits | null>;
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
  tagOptions: DashboardTagOption[];
  dailyData: DashboardDailyCountRow[];
  domainBreakdown: Array<{
    domain: string;
    count: number;
    rate: number;
  }>;
  tagBreakdown: Array<{
    name: string;
    value: string;
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
    broadcastsUsed: number;
    broadcastsLimit: number | "Unlimited";
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

  if (input.tagName) {
    const tagPredicate: Array<{ name: string; value?: string }> = [
      input.tagValue === null
        ? { name: input.tagName }
        : { name: input.tagName, value: input.tagValue },
    ];
    conditions.push(
      sql`${emails.tags} @> ${JSON.stringify(tagPredicate)}::jsonb`,
    );
  }

  return conditions;
}

function isStoredEmailTag(value: unknown): value is DashboardStoredEmailTag {
  if (!value || typeof value !== "object") return false;
  const tag = value as Record<string, unknown>;
  return typeof tag.name === "string" && typeof tag.value === "string";
}

function collectTagOptions(
  rows: Array<{ tags: DashboardStoredEmailTag[] | null }>,
): DashboardTagOption[] {
  const valuesByName = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!Array.isArray(row.tags)) continue;
    for (const tag of row.tags) {
      if (!isStoredEmailTag(tag) || tag.name === "") continue;
      const values = valuesByName.get(tag.name) ?? new Set<string>();
      values.add(tag.value);
      valuesByName.set(tag.name, values);
    }
  }

  return Array.from(valuesByName.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, values]) => ({
      name,
      values: Array.from(values).sort((left, right) =>
        left.localeCompare(right),
      ),
    }));
}

const DASHBOARD_TAG_OPTIONS_EMAIL_LIMIT = 5000;
const DASHBOARD_TAG_BREAKDOWN_LIMIT = 50;

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
        delivered: sql<number>`count(*) filter (where ${emailEventExists(["delivered"])})::int`,
        bounced: sql<number>`count(*) filter (where ${bouncedEmailEventExists()})::int`,
        hard_bounced: sql<number>`count(*) filter (where ${bouncedEmailEventExists(sql`${emailEvents.payload}->>'bounceType' = 'Permanent'`)})::int`,
        soft_bounced: sql<number>`count(*) filter (where ${bouncedEmailEventExists(sql`${emailEvents.payload}->>'bounceType' = 'Transient'`)})::int`,
        undetermined_bounced: sql<number>`count(*) filter (where ${bouncedEmailEventExists(sql`coalesce(${emailEvents.payload}->>'bounceType', '') not in ('Permanent', 'Transient')`)})::int`,
        complained: sql<number>`count(*) filter (where ${emailEventExists(["complained"])})::int`,
      })
      .from(emails)
      .where(and(...metricConditions(input)));

    return stats ?? emptyMetricsStats;
  },

  async listDailyCounts(input) {
    const conditions = metricConditions(input);
    if (input.statuses && input.statuses.length > 0) {
      conditions.push(emailEventExists(input.statuses));
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
        bounced: sql<number>`count(*) filter (where ${bouncedEmailEventExists()})::int`,
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
        complained: sql<number>`count(*) filter (where ${emailEventExists(["complained"])})::int`,
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
        delivered: sql<number>`count(*) filter (where ${emailEventExists(["delivered"])})::int`,
      })
      .from(emails)
      .where(and(...metricConditions(input)))
      .groupBy(senderDomainSql)
      .orderBy(sql`count(*) desc`);
  },

  async listTagBreakdown(input) {
    const rows = await db
      .select({
        tags: emails.tags,
        delivered: sql<boolean>`${emailEventExists(["delivered"])}`,
      })
      .from(emails)
      .where(and(...metricConditions(input)))
      .orderBy(sql`${emails.createdAt} desc`)
      .limit(DASHBOARD_TAG_OPTIONS_EMAIL_LIMIT);

    const statsByTag = new Map<string, DashboardTagBreakdownRow>();
    for (const row of rows) {
      if (!Array.isArray(row.tags)) continue;
      for (const tag of row.tags) {
        if (!isStoredEmailTag(tag) || tag.name === "") continue;
        const key = JSON.stringify([tag.name, tag.value]);
        const existing = statsByTag.get(key) ?? {
          name: tag.name,
          value: tag.value,
          total: 0,
          delivered: 0,
        };
        existing.total += 1;
        if (row.delivered) existing.delivered += 1;
        statsByTag.set(key, existing);
      }
    }

    return Array.from(statsByTag.values())
      .sort((left, right) => {
        const totalDiff = right.total - left.total;
        if (totalDiff !== 0) return totalDiff;
        const nameDiff = left.name.localeCompare(right.name);
        return nameDiff !== 0
          ? nameDiff
          : left.value.localeCompare(right.value);
      })
      .slice(0, DASHBOARD_TAG_BREAKDOWN_LIMIT);
  },

  async listTagOptions(input) {
    const rows = await db
      .select({ tags: emails.tags })
      .from(emails)
      .where(
        and(
          ...metricConditions({
            ...input,
            tagName: null,
            tagValue: null,
          }),
        ),
      )
      .orderBy(sql`${emails.createdAt} desc`)
      .limit(DASHBOARD_TAG_OPTIONS_EMAIL_LIMIT);

    return collectTagOptions(rows);
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
  return EVENT_TYPE_TO_EVENT_TYPES[eventType];
}

function getUsageBounds(now: Date): DashboardUsageCountInput {
  return {
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1),
    startOfDay: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

export function createDashboardAggregateService({
  repository = defaultDashboardAggregateRepository,
  loadPlanLimits = defaultLoadPlanLimits,
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
        tagName: input.tagName,
        tagValue: input.tagValue,
      };
      const [
        stats,
        dailyRows,
        dailyBounceRows,
        dailyComplainRows,
        domainRows,
        tagRows,
        tagOptions,
      ] = await Promise.all([
        repository.aggregateMetrics(baseInput),
        repository.listDailyCounts({
          ...baseInput,
          statuses: getEventStatuses(input.eventType),
        }),
        repository.listDailyBounceRates(baseInput),
        repository.listDailyComplainRates(baseInput),
        repository.listDomainBreakdown(baseInput),
        repository.listTagBreakdown(baseInput),
        repository.listTagOptions(baseInput),
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
        tagOptions,
        dailyData: dailyRows.map((row) => ({
          date: row.date,
          count: row.count,
        })),
        domainBreakdown,
        tagBreakdown: tagRows.map((row) => ({
          name: row.name,
          value: row.value,
          count: row.total,
          rate: roundRate(row.delivered, row.total),
        })),
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
      const [counts, plan] = await Promise.all([
        repository.countUsage(getUsageBounds(now)),
        loadPlanLimits(),
      ]);

      const monthlyLimit =
        plan?.monthlyEmailQuota ??
        DASHBOARD_USAGE_LIMITS.transactional.monthlyLimit;
      const dailyLimit =
        plan?.dailyEmailQuota ??
        DASHBOARD_USAGE_LIMITS.transactional.dailyLimit;
      const contactsLimit =
        plan?.maxContacts ?? DASHBOARD_USAGE_LIMITS.marketing.contactsLimit;
      const segmentsLimit =
        plan?.maxSegments ?? DASHBOARD_USAGE_LIMITS.marketing.segmentsLimit;
      const broadcastsRaw = plan
        ? plan.maxBroadcasts
        : DASHBOARD_USAGE_LIMITS.marketing.broadcastsLimit;
      const broadcastsLimit: number | "Unlimited" =
        broadcastsRaw === null ? "Unlimited" : broadcastsRaw;
      const domainsLimit =
        plan?.maxDomains ?? DASHBOARD_USAGE_LIMITS.team.domainsLimit;
      const rateLimit =
        plan?.ratePerSecond ?? DASHBOARD_USAGE_LIMITS.team.rateLimit;

      return {
        plan: {
          name: plan?.name ?? FREE_PLAN_DEFAULTS.name,
          slug: plan?.slug ?? FREE_PLAN_DEFAULTS.slug,
        },
        transactional: {
          monthlyUsed: counts.monthlyEmails,
          monthlyLimit,
          dailyUsed: counts.dailyEmails,
          dailyLimit,
        },
        marketing: {
          contactsUsed: counts.contacts,
          contactsLimit,
          segmentsUsed: counts.segments,
          segmentsLimit,
          broadcastsUsed: 0,
          broadcastsLimit,
        },
        team: {
          domainsUsed: counts.domains,
          domainsLimit,
          rateLimit,
        },
      };
    },
  };
}

export const dashboardAggregateService = createDashboardAggregateService();
