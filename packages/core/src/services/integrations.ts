import { createHmac } from "node:crypto";
import { integrationConnectionRepo } from "../db/repositories/integrationConnectionRepo";
import type {
  IntegrationConnectionStatus,
  IntegrationHealthStatus,
  IntegrationProvider,
  integrationConnections,
} from "../db/schema";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../security/integration-secret-crypto";
import {
  UnsafeOutboundUrlError,
  assertSafeOutboundUrl,
  safeOutboundFetch,
} from "../security/url-safety";

type IntegrationConnectionRow = typeof integrationConnections.$inferSelect;
type IntegrationConnectionInsert = typeof integrationConnections.$inferInsert;

export type IntegrationConnectionPublic = {
  id: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationConnectionStatus;
  scopes: string[];
  config: {
    webhook?: {
      endpointHost?: string;
      endpointPreview?: string;
      hasSigningSecret?: boolean;
    };
  };
  health: IntegrationHealthStatus;
  lastHealthCheckAt: Date | null;
  lastSyncAt: Date | null;
  lastEventAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type IntegrationCatalogItem = {
  provider: IntegrationProvider;
  name: string;
  description: string;
  status: "installed" | "uninstalled";
  connection: IntegrationConnectionPublic | null;
};

export type WebhookConnectionCredentials = {
  webhookUrl: string;
  signingSecret?: string | null;
};

export type ConnectWebhookInput = {
  userId: string;
  name?: string;
  webhookUrl: string;
  signingSecret?: string | null;
};

export type UpdateWebhookConnectionInput = {
  name?: string;
  webhookUrl?: string;
  signingSecret?: string | null;
};

export type WebhookTestEventResult = {
  connection: IntegrationConnectionPublic;
  delivery: {
    ok: boolean;
    status: number;
    statusText: string;
  };
};

export type IntegrationRepository = {
  create(data: IntegrationConnectionInsert): Promise<IntegrationConnectionRow>;
  findById(
    id: string,
    userId: string,
  ): Promise<IntegrationConnectionRow | undefined>;
  findFirstByProvider(input: {
    userId: string;
    provider: IntegrationProvider;
  }): Promise<IntegrationConnectionRow | undefined>;
  list(options: { userId: string; limit?: number; after?: string }): Promise<{
    data: IntegrationConnectionRow[];
    hasMore: boolean;
  }>;
  update(
    id: string,
    userId: string,
    data: Partial<IntegrationConnectionInsert>,
  ): Promise<IntegrationConnectionRow | undefined>;
  delete(id: string, userId: string): Promise<{ id: string } | undefined>;
};

export type IntegrationFetch = (
  url: string,
  init: RequestInit & {
    method: "POST";
    headers: Record<string, string>;
    body: string;
    redirect: "error";
  },
) => Promise<Pick<Response, "ok" | "status" | "statusText">>;

export type IntegrationServiceDependencies = {
  repository?: IntegrationRepository;
  fetchImpl?: IntegrationFetch;
};

export type IntegrationServiceErrorCode =
  | "not_found"
  | "invalid_provider"
  | "invalid_config"
  | "unsafe_url"
  | "dispatch_failed";

export class IntegrationServiceError extends Error {
  constructor(
    readonly code: IntegrationServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IntegrationServiceError";
  }
}

const WEBHOOK_SCOPES = ["integration:webhook:test_event"] as const;
const WEBHOOK_TEST_DISPATCH_TIMEOUT_MS = 10_000;

function normalizeName(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed || "Webhook connector";
}

function redactUrlForPreview(raw: string): {
  endpointHost?: string;
  endpointPreview?: string;
} {
  try {
    const url = new URL(raw);
    const host = url.host;
    const pathParts = url.pathname.split("/").filter(Boolean);
    const firstPath = pathParts[0] ? `/${pathParts[0]}` : "";
    return {
      endpointHost: host,
      endpointPreview: `${url.protocol}//${host}${firstPath}${pathParts.length > 1 ? "/…" : ""}`,
    };
  } catch {
    return {};
  }
}

function serializeCredentials(
  credentials: WebhookConnectionCredentials,
): string {
  return encryptIntegrationSecret(JSON.stringify(credentials));
}

function parseCredentials(payload: string): WebhookConnectionCredentials {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decryptIntegrationSecret(payload));
  } catch (error) {
    throw new IntegrationServiceError(
      "invalid_config",
      error instanceof Error
        ? `Stored integration credentials could not be decrypted: ${error.message}`
        : "Stored integration credentials could not be decrypted",
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { webhookUrl?: unknown }).webhookUrl !== "string"
  ) {
    throw new IntegrationServiceError(
      "invalid_config",
      "Stored integration credentials are invalid",
    );
  }

  const candidate = parsed as {
    webhookUrl: string;
    signingSecret?: unknown;
  };
  return {
    webhookUrl: candidate.webhookUrl,
    signingSecret:
      typeof candidate.signingSecret === "string"
        ? candidate.signingSecret
        : null,
  };
}

function configForCredentials(credentials: WebhookConnectionCredentials) {
  return {
    webhook: {
      ...redactUrlForPreview(credentials.webhookUrl),
      hasSigningSecret: Boolean(credentials.signingSecret),
    },
  };
}

function toPublicConnection(
  row: IntegrationConnectionRow,
): IntegrationConnectionPublic {
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    status: row.status,
    scopes: row.scopes,
    config: row.config,
    health: row.healthStatus,
    lastHealthCheckAt: row.lastHealthCheckAt,
    lastSyncAt: row.lastSyncAt,
    lastEventAt: row.lastEventAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function assertWebhookUrlSafe(
  raw: string,
  context: "create" | "dispatch",
) {
  try {
    await assertSafeOutboundUrl(raw, { context });
  } catch (error) {
    if (error instanceof UnsafeOutboundUrlError) {
      throw new IntegrationServiceError(
        "unsafe_url",
        `Webhook connector URL rejected: ${error.reason}`,
      );
    }
    throw error;
  }
}

function buildTestPayload(connection: IntegrationConnectionPublic): string {
  return JSON.stringify({
    type: "integration.test",
    created_at: new Date().toISOString(),
    data: {
      provider: connection.provider,
      connection_id: connection.id,
      connection_name: connection.name,
    },
  });
}

function signPayload(
  body: string,
  signingSecret: string | null | undefined,
): Record<string, string> {
  if (!signingSecret) return {};
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return {
    "x-opensend-timestamp": timestamp,
    "x-opensend-signature": signature,
  };
}

function sanitizeDispatchError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return "Webhook connector test dispatch failed";
}

async function fetchWebhookTestWithTimeout(
  fetchImpl: IntegrationFetch,
  url: string,
  init: Parameters<IntegrationFetch>[1],
): ReturnType<IntegrationFetch> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, WEBHOOK_TEST_DISPATCH_TIMEOUT_MS);

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error(
        `Webhook connector test dispatch timed out after ${WEBHOOK_TEST_DISPATCH_TIMEOUT_MS}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createIntegrationService({
  repository = integrationConnectionRepo,
  fetchImpl = (url, init) =>
    safeOutboundFetch(url, init, { context: "dispatch" }),
}: IntegrationServiceDependencies = {}) {
  return {
    async listCatalog(input: {
      userId: string;
    }): Promise<IntegrationCatalogItem[]> {
      const connection = await repository.findFirstByProvider({
        userId: input.userId,
        provider: "webhook",
      });

      return [
        {
          provider: "webhook",
          name: "Webhook / Zapier",
          description:
            "Send a signed test event to any HTTPS automation webhook, including Zapier catch hooks.",
          status:
            connection && connection.status === "connected"
              ? "installed"
              : "uninstalled",
          connection: connection ? toPublicConnection(connection) : null,
        },
      ];
    },

    async listConnections(input: {
      userId: string;
      limit?: number;
      after?: string;
    }) {
      const result = await repository.list(input);
      return {
        data: result.data.map(toPublicConnection),
        hasMore: result.hasMore,
      };
    },

    async getConnection(input: { id: string; userId: string }) {
      const row = await repository.findById(input.id, input.userId);
      return row ? toPublicConnection(row) : null;
    },

    async getWebhookConnection(input: { userId: string }) {
      const row = await repository.findFirstByProvider({
        userId: input.userId,
        provider: "webhook",
      });
      return row ? toPublicConnection(row) : null;
    },

    async connectWebhook(
      input: ConnectWebhookInput,
    ): Promise<IntegrationConnectionPublic> {
      const name = normalizeName(input.name);
      const credentials: WebhookConnectionCredentials = {
        webhookUrl: input.webhookUrl.trim(),
        signingSecret: input.signingSecret?.trim() || null,
      };
      await assertWebhookUrlSafe(credentials.webhookUrl, "create");

      const row = await repository.create({
        userId: input.userId,
        provider: "webhook",
        name,
        status: "connected",
        scopes: [...WEBHOOK_SCOPES],
        config: configForCredentials(credentials),
        credentialsEnc: serializeCredentials(credentials),
        healthStatus: "unknown",
        lastSyncAt: new Date(),
        lastError: null,
      });

      return toPublicConnection(row);
    },

    async updateWebhookConnection(input: {
      id: string;
      userId: string;
      update: UpdateWebhookConnectionInput;
    }): Promise<IntegrationConnectionPublic> {
      const existing = await repository.findById(input.id, input.userId);
      if (!existing) {
        throw new IntegrationServiceError(
          "not_found",
          "Integration connection not found",
        );
      }
      if (existing.provider !== "webhook") {
        throw new IntegrationServiceError(
          "invalid_provider",
          "Only webhook connector configuration can be updated here",
        );
      }

      const currentCredentials = parseCredentials(existing.credentialsEnc);
      const credentials: WebhookConnectionCredentials = {
        webhookUrl:
          input.update.webhookUrl?.trim() || currentCredentials.webhookUrl,
        signingSecret:
          input.update.signingSecret === undefined
            ? currentCredentials.signingSecret
            : input.update.signingSecret?.trim() || null,
      };
      await assertWebhookUrlSafe(credentials.webhookUrl, "create");

      const row = await repository.update(input.id, input.userId, {
        name: normalizeName(input.update.name ?? existing.name),
        status: "connected",
        scopes: [...WEBHOOK_SCOPES],
        config: configForCredentials(credentials),
        credentialsEnc: serializeCredentials(credentials),
        healthStatus: "unknown",
        lastSyncAt: new Date(),
        lastError: null,
      });
      if (!row) {
        throw new IntegrationServiceError(
          "not_found",
          "Integration connection not found",
        );
      }
      return toPublicConnection(row);
    },

    async disconnect(input: {
      id: string;
      userId: string;
    }): Promise<IntegrationConnectionPublic> {
      const row = await repository.update(input.id, input.userId, {
        status: "disconnected",
        healthStatus: "unknown",
        lastSyncAt: new Date(),
        lastError: null,
      });
      if (!row) {
        throw new IntegrationServiceError(
          "not_found",
          "Integration connection not found",
        );
      }
      return toPublicConnection(row);
    },

    async sendWebhookTestEvent(input: {
      id: string;
      userId: string;
    }): Promise<WebhookTestEventResult> {
      const row = await repository.findById(input.id, input.userId);
      if (!row) {
        throw new IntegrationServiceError(
          "not_found",
          "Integration connection not found",
        );
      }
      if (row.provider !== "webhook") {
        throw new IntegrationServiceError(
          "invalid_provider",
          "Only webhook connector test events are supported",
        );
      }
      const credentials = parseCredentials(row.credentialsEnc);
      await assertWebhookUrlSafe(credentials.webhookUrl, "dispatch");

      const publicConnection = toPublicConnection(row);
      const body = buildTestPayload(publicConnection);
      try {
        const headers: Record<string, string> = {
          "content-type": "application/json",
          "x-opensend-integration-provider": "webhook",
          ...signPayload(body, credentials.signingSecret),
        };
        const response = await fetchWebhookTestWithTimeout(
          fetchImpl,
          credentials.webhookUrl,
          {
            method: "POST",
            headers,
            body,
            redirect: "error",
          },
        );
        const updated = await repository.update(input.id, input.userId, {
          healthStatus: response.ok ? "healthy" : "unhealthy",
          lastHealthCheckAt: new Date(),
          lastEventAt: new Date(),
          lastError: response.ok
            ? null
            : `Webhook test returned ${response.status}`,
        });
        return {
          connection: toPublicConnection(updated ?? row),
          delivery: {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
          },
        };
      } catch (error) {
        const lastError = sanitizeDispatchError(error);
        const updated = await repository.update(input.id, input.userId, {
          healthStatus: "unhealthy",
          lastHealthCheckAt: new Date(),
          lastError,
        });
        throw new IntegrationServiceError(
          "dispatch_failed",
          updated?.lastError ?? lastError,
        );
      }
    },
  };
}

export const integrationService = createIntegrationService();
