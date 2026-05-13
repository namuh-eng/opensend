import { describe, expect, it, vi } from "vitest";
import {
  type WebhookDeliveryRepository,
  type WebhookRepository,
  WebhookServiceError,
  createWebhookService,
} from "../packages/core/src/services/webhook";

type WebhookRow = NonNullable<
  Awaited<ReturnType<WebhookRepository["findById"]>>
>;
type WebhookInsert = Parameters<WebhookRepository["create"]>[0];
type WebhookDeliveryRow = NonNullable<
  Awaited<ReturnType<WebhookDeliveryRepository["findById"]>>
>;
type WebhookDeliveryInsert = Parameters<WebhookDeliveryRepository["create"]>[0];

function webhookRow(overrides: Partial<WebhookRow> = {}): WebhookRow {
  return {
    id: "webhook-1",
    url: "https://example.com/webhook",
    eventTypes: ["email.sent"],
    status: "active",
    signingSecret: "whsec_existing",
    signingSecretEnc: null,
    createdAt: new Date("2026-05-04T00:00:00.000Z"),
    document: null,
    userId: null,
    ...overrides,
  };
}

function createRepository(overrides: Partial<WebhookRepository> = {}) {
  const repository: WebhookRepository = {
    async list() {
      return { data: [], hasMore: false };
    },
    async create(data: WebhookInsert) {
      return [webhookRow({ ...data, id: "created-webhook" })];
    },
    async findById() {
      return webhookRow();
    },
    async update(id, _userId, data) {
      return [webhookRow({ id, ...data })];
    },
    async delete(id: string) {
      return [{ id }];
    },
    ...overrides,
  };

  return repository;
}

function deliveryRow(
  overrides: Partial<WebhookDeliveryRow> = {},
): WebhookDeliveryRow {
  return {
    id: "delivery-1",
    webhookId: "webhook-1",
    eventId: "event-1",
    attempt: 2,
    statusCode: 503,
    responseBody: "unavailable",
    status: "pending",
    attemptedAt: new Date("2026-05-06T00:00:00.000Z"),
    nextRetryAt: new Date("2026-05-06T00:05:00.000Z"),
    createdAt: new Date("2026-05-05T23:59:00.000Z"),
    ...overrides,
  };
}

function createDeliveryRepository(
  overrides: Partial<WebhookDeliveryRepository> = {},
) {
  const repository: WebhookDeliveryRepository = {
    async findById(id) {
      return deliveryRow({ id });
    },
    async create(data: WebhookDeliveryInsert) {
      return deliveryRow({ ...data, id: "delivery-replay" });
    },
    async listByWebhookId() {
      return { data: [], hasMore: false };
    },
    ...overrides,
  };

  return repository;
}

describe("webhook service", () => {
  it("lists with normalized pagination and maps public list fields", async () => {
    let listOptions: { userId: string; limit?: number; after?: string } | null =
      null;
    const service = createWebhookService({
      repository: createRepository({
        async list(options) {
          listOptions = options;
          return {
            data: [
              webhookRow({
                id: "webhook-2",
                status: "disabled",
                createdAt: new Date("2026-05-04T01:00:00.000Z"),
              }),
            ],
            hasMore: true,
          };
        },
      }),
    });

    const result = await service.listWebhooks({
      userId: "user-1",
      limit: 500,
      after: "webhook-3",
    });

    expect(listOptions).toEqual({
      userId: "user-1",
      limit: 100,
      after: "webhook-3",
    });
    expect(result).toEqual({
      data: [
        {
          id: "webhook-2",
          endpoint: "https://example.com/webhook",
          events: ["email.sent"],
          status: "disabled",
          createdAt: new Date("2026-05-04T01:00:00.000Z"),
        },
      ],
      hasMore: true,
    });
  });

  it("creates with an injectable signing secret generator", async () => {
    const inserted: WebhookInsert[] = [];
    const generateSigningSecret = vi.fn(() => "whsec_test_secret");
    const service = createWebhookService({
      generateSigningSecret,
      repository: createRepository({
        async create(data) {
          inserted.push(data);
          return [webhookRow({ ...data, id: "created-webhook" })];
        },
      }),
    });

    const result = await service.createWebhook({
      userId: "user-1",
      endpoint: "https://example.com/created",
      events: ["email.delivered"],
    });

    expect(generateSigningSecret).toHaveBeenCalledOnce();
    expect(inserted[0]).toMatchObject({
      userId: "user-1",
      url: "https://example.com/created",
      eventTypes: ["email.delivered"],
      signingSecret: "whsec_test_secret",
    });
    expect(result).toMatchObject({
      id: "created-webhook",
      endpoint: "https://example.com/created",
      events: ["email.delivered"],
      status: "enabled",
      signingSecret: "whsec_test_secret",
    });
  });

  it("maps update status and active flags to stored status", async () => {
    const updates: Array<Partial<WebhookInsert>> = [];
    const service = createWebhookService({
      repository: createRepository({
        async update(id, _userId, data) {
          updates.push(data);
          return [webhookRow({ id, ...data })];
        },
      }),
    });

    const disabled = await service.updateWebhook("webhook-1", "user-1", {
      endpoint: "https://example.com/new",
      events: ["email.bounced"],
      status: "disabled",
    });
    const enabled = await service.updateWebhook("webhook-1", "user-1", {
      active: true,
    });

    expect(updates).toEqual([
      {
        url: "https://example.com/new",
        eventTypes: ["email.bounced"],
        status: "disabled",
      },
      { status: "active" },
    ]);
    expect(disabled).toMatchObject({
      endpoint: "https://example.com/new",
      events: ["email.bounced"],
      status: "disabled",
    });
    expect(enabled).toMatchObject({ status: "enabled" });
  });

  it("includes recent delivery retry visibility on webhook detail", async () => {
    const service = createWebhookService({
      repository: createRepository({
        async findById(id, _userId) {
          return webhookRow({ id });
        },
      }),
      deliveryRepository: createDeliveryRepository({
        async listByWebhookId(webhookId, options) {
          expect(webhookId).toBe("webhook-1");
          expect(options).toEqual({ limit: 20 });
          return {
            data: [
              {
                id: "delivery-1",
                webhookId: "webhook-1",
                eventId: "event-1",
                attempt: 2,
                statusCode: 503,
                responseBody: "unavailable",
                status: "pending",
                attemptedAt: new Date("2026-05-06T00:00:00.000Z"),
                nextRetryAt: new Date("2026-05-06T00:05:00.000Z"),
                createdAt: new Date("2026-05-05T23:59:00.000Z"),
              },
            ],
            hasMore: false,
          };
        },
      }),
    });

    const result = await service.getWebhook("webhook-1", "user-1");

    expect(result?.recentDeliveries).toEqual([
      {
        id: "delivery-1",
        status: "pending",
        attempt: 2,
        statusCode: 503,
        responseBody: "unavailable",
        attemptedAt: new Date("2026-05-06T00:00:00.000Z"),
        nextRetryAt: new Date("2026-05-06T00:05:00.000Z"),
        createdAt: new Date("2026-05-05T23:59:00.000Z"),
      },
    ]);
  });

  it("returns undefined for not found get, update, and delete operations", async () => {
    const service = createWebhookService({
      repository: createRepository({
        async findById() {
          return undefined;
        },
        async update() {
          return [];
        },
        async delete() {
          return [];
        },
      }),
    });

    await expect(
      service.getWebhook("missing", "user-1"),
    ).resolves.toBeUndefined();
    await expect(
      service.updateWebhook("missing", "user-1", { status: "enabled" }),
    ).resolves.toBeUndefined();
    await expect(
      service.deleteWebhook("missing", "user-1"),
    ).resolves.toBeUndefined();
  });

  it("replays a failed delivery through a fresh dispatched delivery", async () => {
    const created: WebhookDeliveryInsert[] = [];
    const dispatchDelivery = vi.fn(async (deliveryId: string) =>
      deliveryRow({
        id: deliveryId,
        attempt: 1,
        status: "success",
        statusCode: 200,
        responseBody: "accepted",
        attemptedAt: new Date("2026-05-06T00:10:00.000Z"),
        nextRetryAt: null,
      }),
    );
    const service = createWebhookService({
      repository: createRepository({
        async findById(id, userId) {
          expect(id).toBe("webhook-1");
          expect(userId).toBe("user-1");
          return webhookRow({ id, userId });
        },
      }),
      deliveryRepository: createDeliveryRepository({
        async findById(id) {
          return deliveryRow({
            id,
            status: "dead_letter",
            attempt: 8,
            statusCode: 500,
          });
        },
        async create(data) {
          created.push(data);
          return deliveryRow({
            ...data,
            id: "delivery-replay",
            createdAt: new Date("2026-05-06T00:09:59.000Z"),
          });
        },
      }),
      dispatchDelivery,
    });

    const result = await service.replayWebhookDelivery({
      webhookId: "webhook-1",
      deliveryId: "delivery-original",
      userId: "user-1",
    });

    expect(created).toEqual([
      {
        webhookId: "webhook-1",
        eventId: "event-1",
        status: "pending",
        attempt: 0,
        statusCode: null,
        responseBody: null,
        attemptedAt: null,
        nextRetryAt: null,
      },
    ]);
    expect(dispatchDelivery).toHaveBeenCalledWith("delivery-replay");
    expect(result.originalDelivery).toMatchObject({
      id: "delivery-original",
      status: "dead_letter",
      attempt: 8,
    });
    expect(result.replayDelivery).toMatchObject({
      id: "delivery-replay",
      status: "success",
      attempt: 1,
      statusCode: 200,
    });
  });

  it("replays an already successful delivery", async () => {
    const service = createWebhookService({
      repository: createRepository(),
      deliveryRepository: createDeliveryRepository({
        async findById(id) {
          return deliveryRow({
            id,
            status: "success",
            attempt: 1,
            statusCode: 200,
            nextRetryAt: null,
          });
        },
      }),
      dispatchDelivery: async (deliveryId) =>
        deliveryRow({ id: deliveryId, status: "success", attempt: 1 }),
    });

    const result = await service.replayWebhookDelivery({
      webhookId: "webhook-1",
      deliveryId: "delivery-success",
      userId: "user-1",
    });

    expect(result.originalDelivery).toMatchObject({
      id: "delivery-success",
      status: "success",
    });
    expect(result.replayDelivery).toMatchObject({
      id: "delivery-replay",
      status: "success",
      attempt: 1,
    });
  });

  it("prevents replaying another user's delivery by resolving the owned webhook first", async () => {
    const findDelivery = vi.fn();
    const service = createWebhookService({
      repository: createRepository({
        async findById() {
          return undefined;
        },
      }),
      deliveryRepository: createDeliveryRepository({
        findById: findDelivery,
      }),
    });

    await expect(
      service.replayWebhookDelivery({
        webhookId: "webhook-user-a",
        deliveryId: "delivery-user-a",
        userId: "user-b",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Webhook endpoint not found or deleted",
    });
    expect(findDelivery).not.toHaveBeenCalled();
  });

  it("rejects disabled endpoints before creating a replay delivery", async () => {
    const createDelivery = vi.fn();
    const service = createWebhookService({
      repository: createRepository({
        async findById() {
          return webhookRow({ status: "disabled" });
        },
      }),
      deliveryRepository: createDeliveryRepository({
        create: createDelivery,
      }),
    });

    await expect(
      service.replayWebhookDelivery({
        webhookId: "webhook-1",
        deliveryId: "delivery-1",
        userId: "user-1",
      }),
    ).rejects.toBeInstanceOf(WebhookServiceError);
    await expect(
      service.replayWebhookDelivery({
        webhookId: "webhook-1",
        deliveryId: "delivery-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "disabled",
      message: "Webhook endpoint is disabled and cannot replay deliveries",
    });
    expect(createDelivery).not.toHaveBeenCalled();
  });

  it("rejects deleted endpoints with a clear not found error", async () => {
    const service = createWebhookService({
      repository: createRepository({
        async findById() {
          return undefined;
        },
      }),
      deliveryRepository: createDeliveryRepository({
        create: vi.fn(),
      }),
    });

    await expect(
      service.replayWebhookDelivery({
        webhookId: "deleted-webhook",
        deliveryId: "delivery-1",
        userId: "user-1",
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Webhook endpoint not found or deleted",
    });
  });
});
