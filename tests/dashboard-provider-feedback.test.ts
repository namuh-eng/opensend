import {
  areAllRecentSenderDomainsWired,
  clearProviderFeedbackWiringCache,
  isSesEventsDestinationWired,
  resolveProviderFeedbackWiring,
} from "@/lib/dashboard-provider-feedback";
import { beforeEach, describe, expect, it, vi } from "vitest";

const topicArn = "arn:aws:sns:us-east-1:123456789012:opensend-ses-events";
const matchingEventTypes = [
  "SEND",
  "DELIVERY",
  "BOUNCE",
  "COMPLAINT",
  "DELIVERY_DELAY",
  "REJECT",
  "RENDERING_FAILURE",
];

describe("dashboard provider feedback wiring", () => {
  beforeEach(() => {
    clearProviderFeedbackWiringCache();
  });

  it("requires an enabled SES destination on the configured SNS topic", () => {
    expect(
      isSesEventsDestinationWired(
        {
          configured: true,
          enabled: true,
          topicArn,
          matchingEventTypes,
        },
        topicArn,
      ),
    ).toBe(true);
    expect(
      isSesEventsDestinationWired(
        {
          configured: true,
          enabled: true,
          topicArn: "arn:aws:sns:us-east-1:123456789012:other-topic",
          matchingEventTypes,
        },
        topicArn,
      ),
    ).toBe(false);
    expect(
      isSesEventsDestinationWired(
        {
          configured: true,
          enabled: false,
          topicArn,
          matchingEventTypes,
        },
        topicArn,
      ),
    ).toBe(false);
    expect(
      isSesEventsDestinationWired(
        {
          configured: true,
          enabled: true,
          topicArn,
          matchingEventTypes: ["DELIVERY"],
        },
        topicArn,
      ),
    ).toBe(false);
  });

  it("fails closed when the topic ARN is missing, the config set is missing, or SES read fails", async () => {
    const readState = vi.fn(async () => {
      throw new Error("ses unavailable");
    });
    const errors: string[] = [];

    await expect(
      resolveProviderFeedbackWiring(
        [
          {
            id: "domain-no-topic",
            name: "no-topic.example",
            region: "us-east-1",
            configurationSetName: "opensend-domain-no-topic",
          },
        ],
        { topicArn: null, readState },
      ),
    ).resolves.toEqual(new Map([["domain-no-topic", false]]));
    expect(readState).not.toHaveBeenCalled();

    await expect(
      resolveProviderFeedbackWiring(
        [
          {
            id: "domain-missing-config",
            name: "missing-config.example",
            region: "us-east-1",
            configurationSetName: null,
          },
        ],
        { topicArn, readState },
      ),
    ).resolves.toEqual(new Map([["domain-missing-config", false]]));
    expect(readState).not.toHaveBeenCalled();

    await expect(
      resolveProviderFeedbackWiring(
        [
          {
            id: "domain-read-fails",
            name: "read-fails.example",
            region: "us-east-1",
            configurationSetName: "opensend-domain-read-fails",
          },
        ],
        {
          topicArn,
          readState,
          onReadError: (candidate, error) => {
            errors.push(
              `${candidate.name}:${error instanceof Error ? error.message : String(error)}`,
            );
          },
        },
      ),
    ).resolves.toEqual(new Map([["domain-read-fails", false]]));
    expect(errors).toEqual(["read-fails.example:ses unavailable"]);
  });

  it("requires every recent sender domain to be provider-feedback wired", () => {
    const candidates = [
      {
        id: "domain-wired",
        name: "wired.example",
        region: "us-east-1",
        configurationSetName: "opensend-domain-wired",
      },
      {
        id: "domain-unwired",
        name: "unwired.example",
        region: "us-east-1",
        configurationSetName: "opensend-domain-unwired",
      },
    ];

    expect(
      areAllRecentSenderDomainsWired(
        candidates,
        new Map([
          ["domain-wired", true],
          ["domain-unwired", true],
        ]),
      ),
    ).toBe(true);
    expect(
      areAllRecentSenderDomainsWired(
        candidates,
        new Map([
          ["domain-wired", true],
          ["domain-unwired", false],
        ]),
      ),
    ).toBe(false);
    expect(areAllRecentSenderDomainsWired([], new Map())).toBe(false);
  });

  it("keys provider feedback by domain id and parallelizes distinct SES reads", async () => {
    let pendingReads = 0;
    let maxConcurrentReads = 0;
    const readState = vi.fn(
      async ({ configurationSetName }: { configurationSetName: string }) => {
        pendingReads += 1;
        maxConcurrentReads = Math.max(maxConcurrentReads, pendingReads);
        await new Promise((resolve) => setTimeout(resolve, 0));
        pendingReads -= 1;
        return {
          configured: true,
          enabled: true,
          topicArn,
          matchingEventTypes:
            configurationSetName === "opensend-domain-b"
              ? ["DELIVERY"]
              : matchingEventTypes,
        };
      },
    );

    await expect(
      resolveProviderFeedbackWiring(
        [
          {
            id: "domain-a",
            name: "same.example",
            region: "us-east-1",
            configurationSetName: "opensend-domain-a",
          },
          {
            id: "domain-b",
            name: "same.example",
            region: "us-east-1",
            configurationSetName: "opensend-domain-b",
          },
          {
            id: "domain-a-alias",
            name: "alias.example",
            region: "us-east-1",
            configurationSetName: "opensend-domain-a",
          },
        ],
        { topicArn, readState },
      ),
    ).resolves.toEqual(
      new Map([
        ["domain-a", true],
        ["domain-b", false],
        ["domain-a-alias", true],
      ]),
    );
    expect(readState).toHaveBeenCalledTimes(2);
    expect(maxConcurrentReads).toBe(2);
  });

  it("uses a short TTL cache for repeated SES destination reads", async () => {
    const readState = vi.fn(async () => ({
      configured: true,
      enabled: true,
      topicArn,
      matchingEventTypes,
    }));
    const candidates = [
      {
        id: "domain-cached",
        name: "cached.example",
        region: "us-east-1",
        configurationSetName: "opensend-domain-cached",
      },
    ];

    await expect(
      resolveProviderFeedbackWiring(candidates, {
        topicArn,
        readState,
        cacheTtlMs: 30_000,
      }),
    ).resolves.toEqual(new Map([["domain-cached", true]]));
    await expect(
      resolveProviderFeedbackWiring(candidates, {
        topicArn,
        readState,
        cacheTtlMs: 30_000,
      }),
    ).resolves.toEqual(new Map([["domain-cached", true]]));

    expect(readState).toHaveBeenCalledTimes(1);
  });

  it("does not cache SES read failures as unwired", async () => {
    const readState = vi.fn(async () => {
      throw new Error("ses unavailable");
    });
    const errors: string[] = [];
    const candidates = [
      {
        id: "domain-error-cache",
        name: "error-cache.example",
        region: "us-east-1",
        configurationSetName: "opensend-domain-error-cache",
      },
    ];

    await expect(
      resolveProviderFeedbackWiring(candidates, {
        topicArn,
        readState,
        cacheTtlMs: 30_000,
        onReadError: (candidate, error) => {
          errors.push(
            `${candidate.name}:${error instanceof Error ? error.message : String(error)}`,
          );
        },
      }),
    ).resolves.toEqual(new Map([["domain-error-cache", false]]));
    await expect(
      resolveProviderFeedbackWiring(candidates, {
        topicArn,
        readState,
        cacheTtlMs: 30_000,
        onReadError: (candidate, error) => {
          errors.push(
            `${candidate.name}:${error instanceof Error ? error.message : String(error)}`,
          );
        },
      }),
    ).resolves.toEqual(new Map([["domain-error-cache", false]]));

    expect(readState).toHaveBeenCalledTimes(2);
    expect(errors).toEqual([
      "error-cache.example:ses unavailable",
      "error-cache.example:ses unavailable",
    ]);
  });
});
