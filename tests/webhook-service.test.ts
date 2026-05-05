import { describe, expect, it, vi } from "vitest";
import {
  type WebhookRepository,
  createWebhookService,
} from "../packages/core/src/services/webhook";

type WebhookRow = NonNullable<
  Awaited<ReturnType<WebhookRepository["findById"]>>
>;
type WebhookInsert = Parameters<WebhookRepository["create"]>[0];

function webhookRow(overrides: Partial<WebhookRow> = {}): WebhookRow {
  return {
    id: "webhook-1",
    url: "https://example.com/webhook",
    eventTypes: ["email.sent"],
    status: "active",
    signingSecret: "whsec_existing",
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
    async update(id, data) {
      return [webhookRow({ id, ...data })];
    },
    async delete(id: string) {
      return [{ id }];
    },
    ...overrides,
  };

  return repository;
}

describe("webhook service", () => {
  it("lists with normalized pagination and maps public list fields", async () => {
    let listOptions: { limit?: number; after?: string } | null = null;
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
      limit: 500,
      after: "webhook-3",
    });

    expect(listOptions).toEqual({ limit: 100, after: "webhook-3" });
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

  it("passes tenant scope to list, get, update, and delete repository operations", async () => {
    const list = vi.fn<WebhookRepository["list"]>().mockResolvedValue({
      data: [webhookRow()],
      hasMore: false,
    });
    const findById = vi
      .fn<WebhookRepository["findById"]>()
      .mockResolvedValue(webhookRow());
    const update = vi
      .fn<WebhookRepository["update"]>()
      .mockResolvedValue([webhookRow({ status: "disabled" })]);
    const deleteWebhook = vi
      .fn<WebhookRepository["delete"]>()
      .mockResolvedValue([{ id: "webhook-1" }]);
    const service = createWebhookService({
      repository: createRepository({
        list,
        findById,
        update,
        delete: deleteWebhook,
      }),
    });

    await service.listWebhooks({
      limit: 20,
      after: "webhook-0",
      userId: "user-1",
    });
    await service.getWebhook("webhook-1", { userId: "user-1" });
    await service.updateWebhook(
      "webhook-1",
      { status: "disabled" },
      { userId: "user-1" },
    );
    await service.deleteWebhook("webhook-1", { userId: "user-1" });

    expect(list).toHaveBeenCalledWith({
      limit: 20,
      after: "webhook-0",
      userId: "user-1",
    });
    expect(findById).toHaveBeenCalledWith("webhook-1", { userId: "user-1" });
    expect(update).toHaveBeenCalledWith(
      "webhook-1",
      { status: "disabled" },
      { userId: "user-1" },
    );
    expect(deleteWebhook).toHaveBeenCalledWith("webhook-1", {
      userId: "user-1",
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
      endpoint: "https://example.com/created",
      events: ["email.delivered"],
    });

    expect(generateSigningSecret).toHaveBeenCalledOnce();
    expect(inserted[0]).toMatchObject({
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

  it("stamps created webhooks with tenant scope when supplied", async () => {
    const inserted: WebhookInsert[] = [];
    const service = createWebhookService({
      repository: createRepository({
        async create(data) {
          inserted.push(data);
          return [webhookRow({ ...data, id: "created-webhook" })];
        },
      }),
    });

    await service.createWebhook({
      endpoint: "https://example.com/created",
      events: ["email.delivered"],
      userId: "user-1",
    });

    expect(inserted[0]).toMatchObject({ userId: "user-1" });
  });

  it("maps update status and active flags to stored status", async () => {
    const updates: Array<Partial<WebhookInsert>> = [];
    const service = createWebhookService({
      repository: createRepository({
        async update(id, data) {
          updates.push(data);
          return [webhookRow({ id, ...data })];
        },
      }),
    });

    const disabled = await service.updateWebhook("webhook-1", {
      endpoint: "https://example.com/new",
      events: ["email.bounced"],
      status: "disabled",
    });
    const enabled = await service.updateWebhook("webhook-1", { active: true });

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

    await expect(service.getWebhook("missing")).resolves.toBeUndefined();
    await expect(
      service.updateWebhook("missing", { status: "enabled" }),
    ).resolves.toBeUndefined();
    await expect(service.deleteWebhook("missing")).resolves.toBeUndefined();
  });
});
