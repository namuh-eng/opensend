import { randomBytes } from "node:crypto";
import { webhookRepo } from "../db/repositories/webhookRepo";
import type { webhooks } from "../db/schema";

type WebhookRow = typeof webhooks.$inferSelect;
type WebhookInsert = typeof webhooks.$inferInsert;

type PublicWebhookStatus = "enabled" | "disabled";
type StoredWebhookStatus = "active" | "disabled";

export type WebhookServiceListItem = {
  id: string;
  endpoint: string;
  events: string[];
  status: PublicWebhookStatus;
  createdAt: WebhookRow["createdAt"];
};

export type WebhookServiceDetail = WebhookServiceListItem;

export type WebhookServiceCreateResult = WebhookServiceDetail & {
  signingSecret: string | null;
};

export type WebhookListResult = {
  data: WebhookServiceListItem[];
  hasMore: boolean;
};

export type CreateWebhookInput = {
  endpoint: string;
  events: string[];
  userId?: string;
};

export type UpdateWebhookInput = {
  endpoint?: string;
  events?: string[];
  status?: PublicWebhookStatus;
  active?: boolean;
};

export type WebhookRepository = {
  list(options: { limit?: number; after?: string; userId?: string }): Promise<{
    data: WebhookRow[];
    hasMore: boolean;
  }>;
  create(data: WebhookInsert): Promise<WebhookRow[]>;
  findById(
    id: string,
    options?: { userId?: string },
  ): Promise<WebhookRow | undefined>;
  update(
    id: string,
    data: Partial<WebhookInsert>,
    options?: { userId?: string },
  ): Promise<WebhookRow[]>;
  delete(
    id: string,
    options?: { userId?: string },
  ): Promise<Array<{ id: string }>>;
};

export type WebhookServiceDependencies = {
  repository?: WebhookRepository;
  generateSigningSecret?: () => string;
};

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit || 20, 1), 100);
}

function generateSecureSigningSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

function toPublicStatus(status: string): PublicWebhookStatus {
  return status === "active" ? "enabled" : "disabled";
}

function toStoredStatus(
  input: PublicWebhookStatus | boolean,
): StoredWebhookStatus {
  if (typeof input === "boolean") return input ? "active" : "disabled";
  return input === "enabled" ? "active" : "disabled";
}

function toWebhookListItem(row: WebhookRow): WebhookServiceListItem {
  return {
    id: row.id,
    endpoint: row.url,
    events: row.eventTypes,
    status: toPublicStatus(row.status),
    createdAt: row.createdAt,
  };
}

function toWebhookCreateResult(row: WebhookRow): WebhookServiceCreateResult {
  return {
    ...toWebhookListItem(row),
    signingSecret: row.signingSecret,
  };
}

function buildUpdateData(input: UpdateWebhookInput): Partial<WebhookInsert> {
  const data: Partial<WebhookInsert> = {};

  if (input.endpoint !== undefined) data.url = input.endpoint;
  if (input.events !== undefined) data.eventTypes = input.events;
  if (input.status !== undefined) data.status = toStoredStatus(input.status);
  if (input.status === undefined && input.active !== undefined) {
    data.status = toStoredStatus(input.active);
  }

  return data;
}

export function createWebhookService({
  repository = webhookRepo,
  generateSigningSecret = generateSecureSigningSecret,
}: WebhookServiceDependencies = {}) {
  return {
    async listWebhooks(options: {
      limit?: number;
      after?: string;
      userId?: string;
    }): Promise<WebhookListResult> {
      const result = await repository.list({
        limit: normalizeLimit(options.limit),
        after: options.after || undefined,
        ...(options.userId ? { userId: options.userId } : {}),
      });

      return {
        data: result.data.map(toWebhookListItem),
        hasMore: result.hasMore,
      };
    },

    async createWebhook(
      input: CreateWebhookInput,
    ): Promise<WebhookServiceCreateResult> {
      const signingSecret = generateSigningSecret();
      const [row] = await repository.create({
        url: input.endpoint,
        eventTypes: input.events,
        signingSecret,
        userId: input.userId ?? null,
      });

      return toWebhookCreateResult(row);
    },

    async getWebhook(
      id: string,
      options: { userId?: string } = {},
    ): Promise<WebhookServiceDetail | undefined> {
      const row = await repository.findById(id, { userId: options.userId });
      return row ? toWebhookListItem(row) : undefined;
    },

    async updateWebhook(
      id: string,
      input: UpdateWebhookInput,
      options: { userId?: string } = {},
    ): Promise<WebhookServiceDetail | undefined> {
      const [row] = await repository.update(id, buildUpdateData(input), {
        userId: options.userId,
      });
      return row ? toWebhookListItem(row) : undefined;
    },

    async deleteWebhook(
      id: string,
      options: { userId?: string } = {},
    ): Promise<{ id: string } | undefined> {
      const [deleted] = await repository.delete(id, { userId: options.userId });
      return deleted;
    },
  };
}

export class WebhookService {
  private readonly service: ReturnType<typeof createWebhookService>;

  constructor(dependencies: WebhookServiceDependencies = {}) {
    this.service = createWebhookService(dependencies);
  }

  async list(options: { limit?: number; after?: string }) {
    return await this.service.listWebhooks(options);
  }

  async create(input: CreateWebhookInput) {
    return await this.service.createWebhook(input);
  }

  async get(id: string) {
    return await this.service.getWebhook(id);
  }

  async update(id: string, input: UpdateWebhookInput) {
    return await this.service.updateWebhook(id, input);
  }

  async delete(id: string) {
    return await this.service.deleteWebhook(id);
  }
}

export const webhookService = createWebhookService();
