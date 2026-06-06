import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type IntegrationFetch,
  type IntegrationRepository,
  createIntegrationService,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../packages/core/src";
import type { integrationConnections } from "../packages/core/src/db/schema";

type IntegrationConnectionRow = typeof integrationConnections.$inferSelect;
type IntegrationConnectionInsert = typeof integrationConnections.$inferInsert;

class MemoryIntegrationRepository implements IntegrationRepository {
  rows: IntegrationConnectionRow[] = [];

  async create(
    data: IntegrationConnectionInsert,
  ): Promise<IntegrationConnectionRow> {
    const now = new Date("2026-06-06T00:00:00.000Z");
    const row: IntegrationConnectionRow = {
      id: data.id ?? randomUUID(),
      userId: data.userId,
      provider: data.provider,
      name: data.name,
      status: data.status ?? "connected",
      scopes: data.scopes,
      config: data.config,
      credentialsEnc: data.credentialsEnc,
      healthStatus: data.healthStatus ?? "unknown",
      lastHealthCheckAt: data.lastHealthCheckAt ?? null,
      lastSyncAt: data.lastSyncAt ?? null,
      lastEventAt: data.lastEventAt ?? null,
      lastError: data.lastError ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
    };
    this.rows.push(row);
    return row;
  }

  async findById(id: string, userId: string) {
    return this.rows.find((row) => row.id === id && row.userId === userId);
  }

  async findFirstByProvider(input: { userId: string; provider: "webhook" }) {
    return this.rows.find(
      (row) => row.userId === input.userId && row.provider === input.provider,
    );
  }

  async list(options: { userId: string; limit?: number }) {
    const limit = options.limit ?? 50;
    const data = this.rows
      .filter((row) => row.userId === options.userId)
      .slice(0, limit);
    return { data, hasMore: false };
  }

  async update(
    id: string,
    userId: string,
    data: Partial<IntegrationConnectionInsert>,
  ) {
    const index = this.rows.findIndex(
      (row) => row.id === id && row.userId === userId,
    );
    if (index === -1) return undefined;
    const current = this.rows[index];
    const updated: IntegrationConnectionRow = {
      ...current,
      ...data,
      id: current.id,
      userId: current.userId,
      provider: data.provider ?? current.provider,
      updatedAt: data.updatedAt ?? new Date("2026-06-06T00:01:00.000Z"),
    };
    this.rows[index] = updated;
    return updated;
  }

  async delete(id: string, userId: string) {
    const index = this.rows.findIndex(
      (row) => row.id === id && row.userId === userId,
    );
    if (index === -1) return undefined;
    this.rows.splice(index, 1);
    return { id };
  }
}

describe("integration connector service", () => {
  beforeEach(() => {
    process.env.INTEGRATION_SECRET_ENCRYPTION_KEY =
      "integration-secret-for-tests-32-bytes";
    vi.restoreAllMocks();
  });

  it("encrypts and decrypts integration credentials without plaintext leakage", () => {
    const plaintext =
      '{"webhookUrl":"https://hooks.zapier.com/hooks/catch/team/secret"}';
    const ciphertext = encryptIntegrationSecret(plaintext);

    expect(ciphertext).toMatch(/^v1\./);
    expect(ciphertext).not.toContain("zapier");
    expect(ciphertext).not.toContain("secret");
    expect(decryptIntegrationSecret(ciphertext)).toBe(plaintext);
  });

  it("validates webhook config and returns only redacted connection data", async () => {
    const repository = new MemoryIntegrationRepository();
    const service = createIntegrationService({ repository });

    const connection = await service.connectWebhook({
      userId: "user-1",
      name: "Zapier",
      webhookUrl:
        "https://hooks.zapier.com/hooks/catch/team-token/secret-token",
      signingSecret: "receiver-secret",
    });

    expect(connection.config.webhook?.endpointPreview).toBe(
      "https://hooks.zapier.com/hooks/…",
    );
    expect(JSON.stringify(connection)).not.toContain("secret-token");
    expect(JSON.stringify(connection)).not.toContain("receiver-secret");
    expect(repository.rows[0]?.credentialsEnc).not.toContain("secret-token");
    expect(repository.rows[0]?.credentialsEnc).not.toContain("receiver-secret");
  });

  it("rejects unsafe webhook URLs before storing credentials", async () => {
    const repository = new MemoryIntegrationRepository();
    const service = createIntegrationService({ repository });

    await expect(
      service.connectWebhook({
        userId: "user-1",
        webhookUrl: "https://token:secret@example.com/catch",
      }),
    ).rejects.toMatchObject({
      code: "unsafe_url",
    });
    expect(repository.rows).toHaveLength(0);
  });

  it("sends a signed test event through the mocked external HTTP boundary", async () => {
    const repository = new MemoryIntegrationRepository();
    const fetchImpl = vi.fn<IntegrationFetch>(async (_url, init) => {
      expect(init.method).toBe("POST");
      expect(init.headers["x-opensend-integration-provider"]).toBe("webhook");
      expect(init.headers["x-opensend-signature"]).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.parse(init.body)).toMatchObject({
        type: "integration.test",
        data: { provider: "webhook", connection_name: "Zapier" },
      });
      return { ok: true, status: 200, statusText: "OK" };
    });
    const service = createIntegrationService({ repository, fetchImpl });
    const connection = await service.connectWebhook({
      userId: "user-1",
      name: "Zapier",
      webhookUrl: "https://example.com/zapier/catch",
      signingSecret: "receiver-secret",
    });

    const result = await service.sendWebhookTestEvent({
      id: connection.id,
      userId: "user-1",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.com/zapier/catch",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.delivery).toEqual({
      ok: true,
      status: 200,
      statusText: "OK",
    });
    expect(result.connection.health).toBe("healthy");
    expect(result.connection.lastEventAt).toBeInstanceOf(Date);
  });
});
