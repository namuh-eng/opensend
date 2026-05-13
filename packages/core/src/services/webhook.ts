import { randomBytes } from "node:crypto";
import { webhookDeliveryRepo } from "../db/repositories/webhookDeliveryRepo";
import { webhookRepo } from "../db/repositories/webhookRepo";
import type { webhookDeliveries, webhooks } from "../db/schema";
import {
  UnsafeOutboundUrlError,
  assertSafeOutboundUrl,
} from "../security/url-safety";
import { encryptWebhookSecret } from "../security/webhook-secret-crypto";

type WebhookRow = typeof webhooks.$inferSelect;
type WebhookInsert = typeof webhooks.$inferInsert;
type WebhookDeliveryRow = typeof webhookDeliveries.$inferSelect;

type PublicWebhookStatus = "enabled" | "disabled";
type StoredWebhookStatus = "active" | "disabled";

export type WebhookServiceListItem = {
  id: string;
  endpoint: string;
  events: string[];
  status: PublicWebhookStatus;
  createdAt: WebhookRow["createdAt"];
};

export type WebhookDeliveryListItem = {
  id: string;
  status: string;
  attempt: number;
  statusCode: WebhookDeliveryRow["statusCode"];
  responseBody: WebhookDeliveryRow["responseBody"];
  attemptedAt: WebhookDeliveryRow["attemptedAt"];
  nextRetryAt: WebhookDeliveryRow["nextRetryAt"];
  createdAt: WebhookDeliveryRow["createdAt"];
};

export type WebhookServiceDetail = WebhookServiceListItem & {
  recentDeliveries: WebhookDeliveryListItem[];
};

export type WebhookServiceCreateResult = WebhookServiceListItem & {
  signingSecret: string | null;
};

export type WebhookListResult = {
  data: WebhookServiceListItem[];
  hasMore: boolean;
};

export type CreateWebhookInput = {
  userId: string;
  endpoint: string;
  events: string[];
};

export type UpdateWebhookInput = {
  endpoint?: string;
  events?: string[];
  status?: PublicWebhookStatus;
  active?: boolean;
};

export type WebhookDeliveryRepository = {
  findById(id: string): Promise<WebhookDeliveryRow | undefined>;
  create(
    data: typeof webhookDeliveries.$inferInsert,
  ): Promise<WebhookDeliveryRow>;
  listByWebhookId(
    webhookId: string,
    options?: { limit?: number; after?: string },
  ): Promise<{
    data: WebhookDeliveryRow[];
    hasMore: boolean;
  }>;
};

export type WebhookReplayResult = {
  originalDelivery: WebhookDeliveryListItem;
  replayDelivery: WebhookDeliveryListItem;
};

export type WebhookDispatchDelivery = (
  deliveryId: string,
) => Promise<WebhookDeliveryRow | null | undefined>;

export type WebhookRepository = {
  list(options: { userId: string; limit?: number; after?: string }): Promise<{
    data: WebhookRow[];
    hasMore: boolean;
  }>;
  create(data: WebhookInsert): Promise<WebhookRow[]>;
  findById(id: string, userId: string): Promise<WebhookRow | undefined>;
  update(
    id: string,
    userId: string,
    data: Partial<WebhookInsert>,
  ): Promise<WebhookRow[]>;
  delete(id: string, userId: string): Promise<Array<{ id: string }>>;
};

export type WebhookServiceDependencies = {
  repository?: WebhookRepository;
  deliveryRepository?: WebhookDeliveryRepository;
  dispatchDelivery?: WebhookDispatchDelivery;
  generateSigningSecret?: () => string;
};

export type WebhookServiceErrorCode =
  | "not_found"
  | "disabled"
  | "dispatch_failed"
  | "unsafe_url";

export class WebhookServiceError extends Error {
  constructor(
    readonly code: WebhookServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WebhookServiceError";
  }
}

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

function toWebhookDeliveryListItem(
  row: WebhookDeliveryRow,
): WebhookDeliveryListItem {
  return {
    id: row.id,
    status: row.status,
    attempt: row.attempt,
    statusCode: row.statusCode,
    responseBody: row.responseBody,
    attemptedAt: row.attemptedAt,
    nextRetryAt: row.nextRetryAt,
    createdAt: row.createdAt,
  };
}

function toWebhookDetail(
  row: WebhookRow,
  deliveries: WebhookDeliveryRow[],
): WebhookServiceDetail {
  return {
    ...toWebhookListItem(row),
    recentDeliveries: deliveries.map(toWebhookDeliveryListItem),
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
  deliveryRepository = webhookDeliveryRepo,
  dispatchDelivery,
  generateSigningSecret = generateSecureSigningSecret,
}: WebhookServiceDependencies = {}) {
  return {
    async listWebhooks(options: {
      userId: string;
      limit?: number;
      after?: string;
    }): Promise<WebhookListResult> {
      const result = await repository.list({
        userId: options.userId,
        limit: normalizeLimit(options.limit),
        after: options.after || undefined,
      });

      return {
        data: result.data.map(toWebhookListItem),
        hasMore: result.hasMore,
      };
    },

    async createWebhook(
      input: CreateWebhookInput,
    ): Promise<WebhookServiceCreateResult> {
      try {
        await assertSafeOutboundUrl(input.endpoint, { context: "create" });
      } catch (err) {
        if (err instanceof UnsafeOutboundUrlError) {
          throw new WebhookServiceError(
            "unsafe_url",
            `Webhook endpoint rejected: ${err.reason}`,
          );
        }
        throw err;
      }
      const plaintextSecret = generateSigningSecret();
      // When the encryption key is configured we store only the AES-GCM
      // envelope. In dev environments without a key (caught by the boot
      // guard in prod), we fall back to the legacy plaintext column so
      // the self-host bootstrap still works.
      const hasEncryptionKey = Boolean(
        process.env.WEBHOOK_SECRET_ENCRYPTION_KEY,
      );
      const signingSecretEnc = hasEncryptionKey
        ? encryptWebhookSecret(plaintextSecret)
        : null;
      const [row] = await repository.create({
        url: input.endpoint,
        eventTypes: input.events,
        signingSecret: hasEncryptionKey ? null : plaintextSecret,
        signingSecretEnc,
        userId: input.userId,
      });

      // The user sees the plaintext secret exactly once at creation time;
      // afterwards only the (possibly encrypted) stored value is readable.
      return {
        ...toWebhookListItem(row),
        signingSecret: plaintextSecret,
      };
    },

    async getWebhook(
      id: string,
      userId: string,
    ): Promise<WebhookServiceDetail | undefined> {
      const row = await repository.findById(id, userId);
      if (!row) return undefined;

      const deliveries = await deliveryRepository.listByWebhookId(row.id, {
        limit: 20,
      });

      return toWebhookDetail(row, deliveries.data);
    },

    async updateWebhook(
      id: string,
      userId: string,
      input: UpdateWebhookInput,
    ): Promise<WebhookServiceListItem | undefined> {
      if (input.endpoint !== undefined) {
        try {
          await assertSafeOutboundUrl(input.endpoint, { context: "create" });
        } catch (err) {
          if (err instanceof UnsafeOutboundUrlError) {
            throw new WebhookServiceError(
              "unsafe_url",
              `Webhook endpoint rejected: ${err.reason}`,
            );
          }
          throw err;
        }
      }
      const [row] = await repository.update(id, userId, buildUpdateData(input));
      return row ? toWebhookListItem(row) : undefined;
    },

    async deleteWebhook(
      id: string,
      userId: string,
    ): Promise<{ id: string } | undefined> {
      const [deleted] = await repository.delete(id, userId);
      return deleted;
    },

    async replayWebhookDelivery(input: {
      webhookId: string;
      deliveryId: string;
      userId: string;
    }): Promise<WebhookReplayResult> {
      const webhook = await repository.findById(input.webhookId, input.userId);
      if (!webhook) {
        throw new WebhookServiceError(
          "not_found",
          "Webhook endpoint not found or deleted",
        );
      }

      if (webhook.status !== "active") {
        throw new WebhookServiceError(
          "disabled",
          "Webhook endpoint is disabled and cannot replay deliveries",
        );
      }

      const originalDelivery = await deliveryRepository.findById(
        input.deliveryId,
      );
      if (!originalDelivery || originalDelivery.webhookId !== input.webhookId) {
        throw new WebhookServiceError(
          "not_found",
          "Webhook delivery not found for this endpoint",
        );
      }

      const replayDelivery = await deliveryRepository.create({
        webhookId: webhook.id,
        eventId: originalDelivery.eventId,
        status: "pending",
        attempt: 0,
        statusCode: null,
        responseBody: null,
        attemptedAt: null,
        nextRetryAt: null,
      });

      const dispatchedDelivery = dispatchDelivery
        ? await dispatchDelivery(replayDelivery.id)
        : replayDelivery;

      if (!dispatchedDelivery) {
        throw new WebhookServiceError(
          "dispatch_failed",
          "Webhook replay delivery could not be dispatched",
        );
      }

      return {
        originalDelivery: toWebhookDeliveryListItem(originalDelivery),
        replayDelivery: toWebhookDeliveryListItem(dispatchedDelivery),
      };
    },
  };
}

export class WebhookService {
  private readonly service: ReturnType<typeof createWebhookService>;

  constructor(dependencies: WebhookServiceDependencies = {}) {
    this.service = createWebhookService(dependencies);
  }

  async list(options: { userId: string; limit?: number; after?: string }) {
    return await this.service.listWebhooks(options);
  }

  async create(input: CreateWebhookInput) {
    return await this.service.createWebhook(input);
  }

  async get(id: string, userId: string) {
    return await this.service.getWebhook(id, userId);
  }

  async update(id: string, userId: string, input: UpdateWebhookInput) {
    return await this.service.updateWebhook(id, userId, input);
  }

  async delete(id: string, userId: string) {
    return await this.service.deleteWebhook(id, userId);
  }

  async replayDelivery(input: {
    webhookId: string;
    deliveryId: string;
    userId: string;
  }) {
    return await this.service.replayWebhookDelivery(input);
  }
}

export const webhookService = createWebhookService();
