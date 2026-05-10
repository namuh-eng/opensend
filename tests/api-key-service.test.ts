import { describe, expect, it, vi } from "vitest";
import {
  type ApiKeyRepository,
  type ApiKeyServiceError,
  createApiKeyService,
  parseCreateApiKeyBody,
  toApiKeyCreateResponse,
  toApiKeyDetailResponse,
  toApiKeyListResponse,
} from "../packages/core/src/services/apiKeys";

type ApiKeyRow = Awaited<ReturnType<ApiKeyRepository["findById"]>> & {};

type ApiKeyInsert = Parameters<ApiKeyRepository["create"]>[0];

function apiKeyRow(overrides: Partial<ApiKeyRow> = {}): ApiKeyRow {
  return {
    id: "key-1",
    name: "Primary",
    tokenHash: "hash-1",
    tokenPreview: "re_123...abcd",
    permission: "full_access",
    domain: null,
    lastUsedAt: null,
    createdAt: new Date("2026-05-02T00:00:00.000Z"),
    document: null,
    userId: null,
    ...overrides,
  };
}

function createRepository(overrides: Partial<ApiKeyRepository> = {}) {
  const repository: ApiKeyRepository = {
    async list() {
      return { data: [], hasMore: false };
    },
    async create(data: ApiKeyInsert) {
      return [apiKeyRow({ tokenHash: data.tokenHash })];
    },
    async findById() {
      return apiKeyRow();
    },
    async delete(id: string) {
      return [{ id }];
    },
    ...overrides,
  };

  return repository;
}

describe("api key service", () => {
  it("creates an API key with trimmed name, hashed token, preview, and cache invalidation", async () => {
    let inserted: ApiKeyInsert | null = null;
    const invalidateAuthCache = vi.fn<(_: string) => Promise<void>>();
    const repository = createRepository({
      async create(data) {
        inserted = data;
        return [apiKeyRow({ id: "created-key", tokenHash: data.tokenHash })];
      },
    });

    const service = createApiKeyService({
      repository,
      generateRawKey: () => "re_1234567890abcdef",
      invalidateAuthCache,
    });

    const result = await service.createApiKey({
      name: "  Primary  ",
      permission: "sending_access",
      domainId: "domain-1",
    });

    expect(result).toEqual({
      id: "created-key",
      token: "re_1234567890abcdef",
      tokenHash:
        "437645b2b0886d92d681fba33b3096bc45cea50aed15a8a812a15fbb7082a49c",
    });
    expect(inserted).toMatchObject({
      name: "Primary",
      tokenHash:
        "437645b2b0886d92d681fba33b3096bc45cea50aed15a8a812a15fbb7082a49c",
      tokenPreview: "re_123...cdef",
      permission: "sending_access",
      domain: "domain-1",
    });
    expect(invalidateAuthCache).toHaveBeenCalledWith(result.tokenHash);
  });

  it("rejects blank and overlong API key names before persistence", async () => {
    const create = vi.fn<ApiKeyRepository["create"]>();
    const service = createApiKeyService({
      repository: createRepository({ create }),
    });

    await expect(service.createApiKey({ name: "   " })).rejects.toMatchObject({
      code: "invalid_name",
      message: "name is required",
    } satisfies Partial<ApiKeyServiceError>);

    await expect(
      service.createApiKey({ name: "x".repeat(51) }),
    ).rejects.toMatchObject({
      code: "name_too_long",
      message: "name must be 50 characters or less",
    } satisfies Partial<ApiKeyServiceError>);

    expect(create).not.toHaveBeenCalled();
  });

  it("lists with normalized pagination and maps only public list fields", async () => {
    let listOptions: { userId: string; limit?: number; after?: string } | null =
      null;
    const service = createApiKeyService({
      repository: createRepository({
        async list(options) {
          listOptions = options;
          return {
            data: [apiKeyRow({ id: "key-2", name: "Secondary" })],
            hasMore: true,
          };
        },
      }),
    });

    const result = await service.listApiKeys({
      userId: "user-1",
      limit: 500,
      after: "key-3",
    });

    expect(listOptions).toEqual({
      userId: "user-1",
      limit: 100,
      after: "key-3",
    });
    expect(result).toEqual({
      data: [
        {
          id: "key-2",
          name: "Secondary",
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          lastUsedAt: null,
          permission: "full_access",
          domain: null,
        },
      ],
      hasMore: true,
    });
  });

  it("parses create payloads without broadening permission or domain inputs", () => {
    expect(
      parseCreateApiKeyBody({
        name: "Primary",
        permission: "sending_access",
        domain_id: "domain-1",
      }),
    ).toEqual({
      name: "Primary",
      permission: "sending_access",
      domainId: "domain-1",
    });

    expect(
      parseCreateApiKeyBody({
        name: 123,
        permission: "admin",
        domain_id: 456,
      }),
    ).toEqual({
      name: "",
      permission: undefined,
      domainId: undefined,
    });
  });

  it("formats public API-key payloads with token visible only on create", () => {
    const created = {
      id: "created-key",
      token: "re_created",
      tokenHash: "hash-created",
    };
    const list = toApiKeyListResponse({
      data: [apiKeyRow({ id: "key-list", name: "List key" })],
      hasMore: false,
    });
    const detail = toApiKeyDetailResponse(
      apiKeyRow({ id: "key-detail", name: "Detail key" }),
    );

    expect(toApiKeyCreateResponse(created)).toEqual({
      id: "created-key",
      token: "re_created",
    });
    expect(JSON.stringify(list)).not.toContain("token");
    expect(JSON.stringify(detail)).not.toContain("token");
    expect(list).toEqual({
      object: "list",
      data: [
        {
          id: "key-list",
          name: "List key",
          created_at: new Date("2026-05-02T00:00:00.000Z"),
          last_used_at: null,
          permission: "full_access",
          domain: null,
        },
      ],
      has_more: false,
    });
    expect(detail).toEqual({
      object: "api_key",
      id: "key-detail",
      name: "Detail key",
      created_at: new Date("2026-05-02T00:00:00.000Z"),
      last_used_at: null,
      permission: "full_access",
      domain: null,
    });
  });

  it("returns not_found for get and delete misses", async () => {
    const service = createApiKeyService({
      repository: createRepository({
        async findById() {
          return undefined;
        },
      }),
    });

    await expect(service.getApiKey("missing", "user-1")).rejects.toMatchObject({
      code: "not_found",
      message: "API key not found",
    } satisfies Partial<ApiKeyServiceError>);
    await expect(
      service.deleteApiKey("missing", "user-1"),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "API key not found",
    } satisfies Partial<ApiKeyServiceError>);
  });
  it("does not delete or invalidate cache for an unowned API key", async () => {
    const findById = vi
      .fn<ApiKeyRepository["findById"]>()
      .mockResolvedValue(undefined);
    const deleteKey = vi.fn<ApiKeyRepository["delete"]>();
    const invalidateAuthCache = vi.fn<(_: string) => Promise<void>>();
    const service = createApiKeyService({
      invalidateAuthCache,
      repository: createRepository({
        findById,
        delete: deleteKey,
      }),
    });

    await expect(
      service.deleteApiKey("key-user-a", "user-b"),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "API key not found",
    } satisfies Partial<ApiKeyServiceError>);

    expect(findById).toHaveBeenCalledWith("key-user-a", "user-b");
    expect(deleteKey).not.toHaveBeenCalled();
    expect(invalidateAuthCache).not.toHaveBeenCalled();
  });
});
