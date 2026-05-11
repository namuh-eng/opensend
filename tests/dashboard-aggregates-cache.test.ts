import { getMetricsAggregateCacheKey } from "@/lib/cache/dashboard-aggregates";
import { describe, expect, it } from "vitest";

describe("dashboard aggregate cache keys", () => {
  it("partitions metrics cache entries by tag filter combinations", () => {
    const base = {
      userId: "user-1",
      range: "last_7_days",
      domain: "example.com",
      eventType: "delivered",
    };

    expect(
      getMetricsAggregateCacheKey({
        ...base,
        tagName: null,
        tagValue: null,
      }),
    ).toBe(
      "dashboard-aggregate:v1:metrics:user-1:last_7_days:example.com:delivered:all:all",
    );
    expect(
      getMetricsAggregateCacheKey({
        ...base,
        tagName: "campaign",
        tagValue: null,
      }),
    ).toBe(
      "dashboard-aggregate:v1:metrics:user-1:last_7_days:example.com:delivered:campaign:all",
    );
    expect(
      getMetricsAggregateCacheKey({
        ...base,
        tagName: "campaign",
        tagValue: "launch",
      }),
    ).toBe(
      "dashboard-aggregate:v1:metrics:user-1:last_7_days:example.com:delivered:campaign:launch",
    );
  });
});
