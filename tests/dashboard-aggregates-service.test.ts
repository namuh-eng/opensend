import {
  type DashboardAggregateRepository,
  createDashboardAggregateService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type MetricsBaseInput = Parameters<
  DashboardAggregateRepository["aggregateMetrics"]
>[0];
type DailyCountsInput = Parameters<
  DashboardAggregateRepository["listDailyCounts"]
>[0];
type UsageCountInput = Parameters<
  DashboardAggregateRepository["countUsage"]
>[0];

function makeRepository(
  overrides: Partial<DashboardAggregateRepository> = {},
): DashboardAggregateRepository {
  return {
    async aggregateMetrics() {
      return {
        total: 0,
        delivered: 0,
        bounced: 0,
        hard_bounced: 0,
        soft_bounced: 0,
        undetermined_bounced: 0,
        complained: 0,
      };
    },
    async listDailyCounts() {
      return [];
    },
    async listDailyBounceRates() {
      return [];
    },
    async listDailyComplainRates() {
      return [];
    },
    async listDomainBreakdown() {
      return [];
    },
    async listTagOptions() {
      return [];
    },
    async countUsage() {
      return {
        monthlyEmails: 0,
        dailyEmails: 0,
        contacts: 0,
        segments: 0,
        domains: 0,
      };
    },
    ...overrides,
  };
}

describe("dashboard aggregate service", () => {
  it("computes the compatible metrics payload and keeps sender-domain filtering exact", async () => {
    const start = new Date("2026-04-17T00:00:00.000Z");
    const end = new Date("2026-04-23T23:59:59.999Z");
    let aggregateInput: MetricsBaseInput | undefined;
    let dailyInput: DailyCountsInput | undefined;
    const service = createDashboardAggregateService({
      repository: makeRepository({
        async aggregateMetrics(input) {
          aggregateInput = input;
          return {
            total: 10,
            delivered: 7,
            bounced: 2,
            hard_bounced: 1,
            soft_bounced: 1,
            undetermined_bounced: 0,
            complained: 1,
          };
        },
        async listDailyCounts(input) {
          dailyInput = input;
          return [{ date: "2026-04-23", count: 7 }];
        },
        async listDailyBounceRates() {
          return [{ date: "2026-04-23", total: 10, bounced: 2 }];
        },
        async listDailyComplainRates() {
          return [{ date: "2026-04-23", total: 10, complained: 1 }];
        },
        async listDomainBreakdown() {
          return [
            { domain: "example.com", total: 10, delivered: 7 },
            { domain: null, total: 1, delivered: 1 },
            { domain: "", total: 1, delivered: 0 },
          ];
        },
      }),
    });

    const payload = await service.getMetrics({
      userId: "user-1",
      start,
      end,
      domain: "example.com",
      tagName: "campaign",
      tagValue: "launch",
      eventType: "opened",
      now: new Date("2026-04-23T06:45:30.000Z"),
    });

    expect(aggregateInput).toEqual({
      userId: "user-1",
      start,
      end,
      domain: "example.com",
      tagName: "campaign",
      tagValue: "launch",
    });
    expect(dailyInput).toEqual({
      userId: "user-1",
      start,
      end,
      domain: "example.com",
      tagName: "campaign",
      tagValue: "launch",
      statuses: ["opened"],
    });
    expect(payload).toEqual({
      totalEmails: 10,
      deliverabilityRate: 70,
      bounceRate: 20,
      complainRate: 10,
      domains: ["example.com"],
      tagOptions: [],
      dailyData: [{ date: "2026-04-23", count: 7 }],
      domainBreakdown: [{ domain: "example.com", count: 10, rate: 70 }],
      bounceBreakdown: {
        permanent: 1,
        transient: 1,
        undetermined: 0,
      },
      dailyBounceData: [{ date: "2026-04-23", rate: 20 }],
      complained: 1,
      dailyComplainData: [{ date: "2026-04-23", rate: 10 }],
      lastUpdated: "2026-04-23T06:45:30.000Z",
    });
  });

  it("applies tenant and tag filters consistently across metric aggregate reads", async () => {
    const start = new Date("2026-05-01T00:00:00.000Z");
    const end = new Date("2026-05-11T23:59:59.999Z");
    const metricInputs: MetricsBaseInput[] = [];
    const dailyInputs: DailyCountsInput[] = [];
    let tagOptionsUserId: string | undefined;

    const service = createDashboardAggregateService({
      repository: makeRepository({
        async aggregateMetrics(input) {
          metricInputs.push(input);
          return {
            total: 0,
            delivered: 0,
            bounced: 0,
            hard_bounced: 0,
            soft_bounced: 0,
            undetermined_bounced: 0,
            complained: 0,
          };
        },
        async listDailyCounts(input) {
          dailyInputs.push(input);
          return [];
        },
        async listDailyBounceRates(input) {
          metricInputs.push(input);
          return [];
        },
        async listDailyComplainRates(input) {
          metricInputs.push(input);
          return [];
        },
        async listDomainBreakdown(input) {
          metricInputs.push(input);
          return [];
        },
        async listTagOptions(userId) {
          tagOptionsUserId = userId;
          return [{ name: "campaign", values: ["launch"] }];
        },
      }),
    });

    const payload = await service.getMetrics({
      userId: "tenant-1",
      start,
      end,
      domain: "example.com",
      tagName: "campaign",
      tagValue: "launch",
      eventType: "delivered",
    });

    const expectedBase = {
      userId: "tenant-1",
      start,
      end,
      domain: "example.com",
      tagName: "campaign",
      tagValue: "launch",
    };
    expect(metricInputs).toEqual([
      expectedBase,
      expectedBase,
      expectedBase,
      expectedBase,
    ]);
    expect(dailyInputs).toEqual([{ ...expectedBase, statuses: ["delivered"] }]);
    expect(tagOptionsUserId).toBe("tenant-1");
    expect(payload.tagOptions).toEqual([
      { name: "campaign", values: ["launch"] },
    ]);
    expect(payload.totalEmails).toBe(0);
    expect(payload.dailyData).toEqual([]);
  });

  it("leaves daily counts unfiltered for all or unknown event types", async () => {
    const dailyInputs: DailyCountsInput[] = [];
    const service = createDashboardAggregateService({
      repository: makeRepository({
        async listDailyCounts(input) {
          dailyInputs.push(input);
          return [];
        },
      }),
    });

    const base = {
      userId: "user-1",
      start: new Date("2026-04-01T00:00:00.000Z"),
      end: new Date("2026-04-02T00:00:00.000Z"),
      domain: null,
      tagName: null,
      tagValue: null,
    };

    await service.getMetrics({ ...base, eventType: "all" });
    await service.getMetrics({ ...base, eventType: "unknown" });

    expect(dailyInputs).toHaveLength(2);
    expect(dailyInputs[0]?.statuses).toBeUndefined();
    expect(dailyInputs[1]?.statuses).toBeUndefined();
  });

  it("keeps the current usage envelope, limits, and local period boundaries", async () => {
    let countInput: UsageCountInput | undefined;
    const service = createDashboardAggregateService({
      repository: makeRepository({
        async countUsage(input) {
          countInput = input;
          return {
            monthlyEmails: 42,
            dailyEmails: 3,
            contacts: 120,
            segments: 4,
            domains: 2,
          };
        },
      }),
    });

    const payload = await service.getUsage(new Date(2026, 3, 23, 15, 45, 30));

    expect(countInput?.startOfMonth).toEqual(new Date(2026, 3, 1));
    expect(countInput?.startOfDay).toEqual(new Date(2026, 3, 23));
    expect(payload).toEqual({
      plan: { name: "Free", slug: "free" },
      transactional: {
        monthlyUsed: 42,
        monthlyLimit: 3000,
        dailyUsed: 3,
        dailyLimit: 100,
      },
      marketing: {
        contactsUsed: 120,
        contactsLimit: 1000,
        segmentsUsed: 4,
        segmentsLimit: 3,
        broadcastsUsed: 0,
        broadcastsLimit: "Unlimited",
      },
      team: {
        domainsUsed: 2,
        domainsLimit: 1,
        rateLimit: 2,
      },
    });
  });
});
