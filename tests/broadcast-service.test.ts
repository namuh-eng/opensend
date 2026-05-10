import {
  type BroadcastMetricsCache,
  type BroadcastRepository,
  BroadcastServiceError,
  createBroadcastService,
} from "@opensend/core";
import { describe, expect, it } from "vitest";

type BroadcastRow = NonNullable<
  Awaited<ReturnType<BroadcastRepository["findByIdForUser"]>>
>;
type BroadcastInsert = Parameters<BroadcastRepository["create"]>[0];
type BroadcastListOptions = Parameters<BroadcastRepository["listForApi"]>[0];
type BroadcastUpdateData = Parameters<BroadcastRepository["updateForUser"]>[2];
type BroadcastSendInput = Parameters<
  BroadcastRepository["updateSendStatusForUser"]
>[0];
type BroadcastMetricsInput = Parameters<
  BroadcastRepository["aggregateMetricsForBroadcast"]
>[0];

function makeBroadcast(overrides: Partial<BroadcastRow> = {}): BroadcastRow {
  return {
    id: "broadcast-1",
    name: "Launch",
    status: "draft",
    from: "team@example.com",
    subject: "Hello",
    html: "<p>Hello</p>",
    replyTo: null,
    previewText: null,
    audienceId: "segment-1",
    topicId: null,
    text: null,
    scheduledAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    document: null,
    userId: "user-1",
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<BroadcastRepository> = {},
): BroadcastRepository {
  return {
    async findByIdForUser() {
      return makeBroadcast();
    },
    async create(data) {
      return [makeBroadcast(data)];
    },
    async updateForUser() {
      return [makeBroadcast({ name: "Updated" })];
    },
    async deleteForUser() {
      return [{ id: "broadcast-1" }];
    },
    async findDeletionCandidateForUser() {
      return { status: "draft" };
    },
    async findSendCandidateForUser() {
      return { status: "draft" };
    },
    async updateSendStatusForUser(input) {
      return [
        {
          id: input.id,
          status: input.status,
          scheduledAt: input.scheduledAt,
        },
      ];
    },
    async findMetricsCandidateForUser(id) {
      return { id };
    },
    async aggregateMetricsForBroadcast() {
      return {
        total: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        opened: 0,
        clicked: 0,
      };
    },
    async listForApi() {
      return { data: [makeBroadcast()], hasMore: false };
    },
    ...overrides,
  };
}

describe("broadcast service boundary", () => {
  it("normalizes list filters and requires caller tenant scope", async () => {
    let capturedOptions: BroadcastListOptions | undefined;
    const service = createBroadcastService({
      repository: makeRepository({
        async listForApi(options) {
          capturedOptions = options;
          return { data: [], hasMore: false };
        },
      }),
    });

    await service.listBroadcasts({
      userId: "user-1",
      limit: 500,
      search: "  launch  ",
      status: " draft ",
      segmentId: " segment-1 ",
      after: " b0 ",
    });

    expect(capturedOptions).toEqual({
      userId: "user-1",
      limit: 120,
      search: "launch",
      status: "draft",
      segmentId: "segment-1",
      after: "b0",
    });
  });

  it("validates create input and stamps new broadcasts with the caller", async () => {
    let capturedData: BroadcastInsert | undefined;
    const createdAt = new Date("2026-02-01T00:00:00Z");
    const service = createBroadcastService({
      repository: makeRepository({
        async create(data) {
          capturedData = data;
          return [
            makeBroadcast({
              id: "broadcast-2",
              name: data.name,
              status: data.status ?? "draft",
              createdAt,
              userId: data.userId,
            }),
          ];
        },
      }),
    });

    const result = await service.createBroadcast({
      userId: "user-2",
      body: {
        name: " Launch ",
        from: " team@example.com ",
        subject: " Hello ",
        segment_id: "segment-2",
        send: true,
        scheduled_at: "2026-03-01T00:00:00Z",
      },
    });

    expect(capturedData).toMatchObject({
      name: "Launch",
      from: "team@example.com",
      subject: "Hello",
      audienceId: "segment-2",
      status: "scheduled",
      userId: "user-2",
    });
    expect(result).toEqual({
      id: "broadcast-2",
      name: "Launch",
      status: "scheduled",
      createdAt,
    });

    await expect(
      service.createBroadcast({
        userId: "user-2",
        body: { from: "team@example.com", subject: "Hello" },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "from, subject, and segment_id are required",
    });
  });

  it("maps update aliases and scopes mutations by id plus user id", async () => {
    let capturedId = "";
    let capturedUserId = "";
    let capturedData: BroadcastUpdateData | undefined;
    const service = createBroadcastService({
      repository: makeRepository({
        async updateForUser(id, userId, data) {
          capturedId = id;
          capturedUserId = userId;
          capturedData = data;
          return [
            makeBroadcast({
              id,
              userId,
              replyTo: String(data.replyTo),
              previewText: String(data.previewText),
              audienceId: String(data.audienceId),
            }),
          ];
        },
      }),
    });

    const result = await service.updateBroadcast({
      id: "broadcast-3",
      userId: "user-3",
      body: {
        reply_to: "reply@example.com",
        preview_text: "Preview",
        audience_id: "segment-3",
      },
    });

    expect(capturedId).toBe("broadcast-3");
    expect(capturedUserId).toBe("user-3");
    expect(capturedData).toEqual({
      replyTo: "reply@example.com",
      previewText: "Preview",
      audienceId: "segment-3",
    });
    expect(result.replyTo).toBe("reply@example.com");
  });

  it("queues or schedules draft broadcasts through tenant-scoped send methods", async () => {
    let candidateLookup: { id: string; userId: string } | undefined;
    let updateInput: BroadcastSendInput | undefined;
    const service = createBroadcastService({
      repository: makeRepository({
        async findSendCandidateForUser(id, userId) {
          candidateLookup = { id, userId };
          return { status: "draft" };
        },
        async updateSendStatusForUser(input) {
          updateInput = input;
          return [
            {
              id: input.id,
              status: input.status,
              scheduledAt: input.scheduledAt,
            },
          ];
        },
      }),
    });

    const result = await service.sendBroadcast({
      id: "broadcast-4",
      userId: "user-4",
      body: { scheduled_at: "2026-06-01T00:00:00.000Z" },
    });

    expect(candidateLookup).toEqual({ id: "broadcast-4", userId: "user-4" });
    expect(updateInput).toEqual({
      id: "broadcast-4",
      userId: "user-4",
      status: "scheduled",
      scheduledAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(result).toEqual({
      id: "broadcast-4",
      status: "scheduled",
      scheduledAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    const sentService = createBroadcastService({
      repository: makeRepository({
        async findSendCandidateForUser() {
          return { status: "queued" };
        },
      }),
    });

    await expect(
      sentService.sendBroadcast({
        userId: "user-4",
        id: "broadcast-4",
        body: {},
      }),
    ).rejects.toMatchObject({
      code: "send_forbidden",
      message: "Cannot send a broadcast in queued status",
    });
  });

  it("computes broadcast metrics with cache key behavior and tenant-scoped aggregation", async () => {
    let metricsLookup: { id: string; userId: string } | undefined;
    let aggregateInput: BroadcastMetricsInput | undefined;
    const writes: Array<{ key: string; value: unknown; ttlSeconds: number }> =
      [];
    const cache: BroadcastMetricsCache = {
      ttlSeconds: 120,
      getKey(input) {
        return `dashboard-aggregate:v1:broadcast-metrics:${input.userId}:${input.broadcastId}`;
      },
      async read() {
        return null;
      },
      async write(key, value, ttlSeconds) {
        writes.push({ key, value, ttlSeconds });
      },
    };
    const service = createBroadcastService({
      metricsCache: cache,
      repository: makeRepository({
        async findMetricsCandidateForUser(id, userId) {
          metricsLookup = { id, userId };
          return { id };
        },
        async aggregateMetricsForBroadcast(input) {
          aggregateInput = input;
          return {
            total: 100,
            delivered: 95,
            bounced: 2,
            complained: 1,
            opened: 40,
            clicked: 10,
          };
        },
      }),
    });

    const result = await service.getBroadcastMetrics({
      userId: "user-5",
      id: "broadcast-5",
    });

    expect(metricsLookup).toEqual({ id: "broadcast-5", userId: "user-5" });
    expect(aggregateInput).toEqual({
      userId: "user-5",
      broadcastId: "broadcast-5",
    });
    expect(result).toEqual({
      cacheStatus: "miss",
      payload: {
        object: "broadcast_metrics",
        broadcast_id: "broadcast-5",
        total: 100,
        delivered: 95,
        bounced: 2,
        complained: 1,
        opened: 40,
        clicked: 10,
        delivery_rate: 95,
        open_rate: 40,
        click_rate: 10,
        bounce_rate: 2,
      },
    });
    expect(writes).toEqual([
      {
        key: "dashboard-aggregate:v1:broadcast-metrics:user-5:broadcast-5",
        value: result.payload,
        ttlSeconds: 120,
      },
    ]);
  });

  it("returns cached broadcast metrics after verifying broadcast ownership", async () => {
    let verified = false;
    let aggregateCalled = false;
    const cachedPayload = {
      object: "broadcast_metrics" as const,
      broadcast_id: "broadcast-6",
      total: 1,
      delivered: 1,
      bounced: 0,
      complained: 0,
      opened: 1,
      clicked: 0,
      delivery_rate: 100,
      open_rate: 100,
      click_rate: 0,
      bounce_rate: 0,
    };
    const service = createBroadcastService({
      metricsCache: {
        ttlSeconds: 120,
        getKey(input) {
          return `${input.userId}:${input.broadcastId}`;
        },
        async read<T>() {
          return cachedPayload as T;
        },
        async write() {},
      },
      repository: makeRepository({
        async findMetricsCandidateForUser() {
          verified = true;
          return { id: "broadcast-6" };
        },
        async aggregateMetricsForBroadcast() {
          aggregateCalled = true;
          return {
            total: 0,
            delivered: 0,
            bounced: 0,
            complained: 0,
            opened: 0,
            clicked: 0,
          };
        },
      }),
    });

    await expect(
      service.getBroadcastMetrics({ userId: "user-6", id: "broadcast-6" }),
    ).resolves.toEqual({ payload: cachedPayload, cacheStatus: "hit" });
    expect(verified).toBe(true);
    expect(aggregateCalled).toBe(false);
  });

  it("keeps delete preconditions in the service boundary", async () => {
    const queuedService = createBroadcastService({
      repository: makeRepository({
        async findDeletionCandidateForUser() {
          return { status: "queued" };
        },
      }),
    });

    await expect(
      queuedService.deleteBroadcast("user-1", "broadcast-1"),
    ).rejects.toBeInstanceOf(BroadcastServiceError);
    await expect(
      queuedService.deleteBroadcast("user-1", "broadcast-1"),
    ).rejects.toMatchObject({
      code: "delete_forbidden",
      message: "Cannot delete a broadcast that is already sent or queued",
    });

    let deletedForUser: { id: string; userId: string } | undefined;
    const draftService = createBroadcastService({
      repository: makeRepository({
        async deleteForUser(id, userId) {
          deletedForUser = { id, userId };
          return [{ id }];
        },
      }),
    });

    await expect(
      draftService.deleteBroadcast("user-2", "broadcast-2"),
    ).resolves.toEqual({ id: "broadcast-2" });
    expect(deletedForUser).toEqual({ id: "broadcast-2", userId: "user-2" });
  });
});
