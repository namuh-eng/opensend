import { createHash, randomUUID } from "node:crypto";
import { apiKeyRepo } from "../db/repositories/apiKeyRepo";
import type { apiKeys } from "../db/schema";

type ApiKeyRow = typeof apiKeys.$inferSelect;
type ApiKeyInsert = typeof apiKeys.$inferInsert;

export type ApiKeyPermission = "full_access" | "sending_access";

export type ApiKeyServiceListItem = Pick<
  ApiKeyRow,
  "id" | "name" | "permission" | "domain" | "createdAt" | "lastUsedAt"
>;

export type ApiKeyDetail = Pick<
  ApiKeyRow,
  "id" | "name" | "permission" | "domain" | "createdAt" | "lastUsedAt"
>;

export type ApiKeyListResult = {
  data: ApiKeyServiceListItem[];
  hasMore: boolean;
};

export type ApiKeyPublicListResponseItem = {
  id: string;
  name: string;
  created_at: ApiKeyServiceListItem["createdAt"];
  last_used_at: ApiKeyServiceListItem["lastUsedAt"];
  permission: ApiKeyServiceListItem["permission"];
  domain: string | null;
};

export type ApiKeyPublicListResponse = {
  object: "list";
  data: ApiKeyPublicListResponseItem[];
  has_more: boolean;
};

export type ApiKeyPublicDetailResponse = {
  object: "api_key";
  id: string;
  name: string;
  created_at: ApiKeyDetail["createdAt"];
  last_used_at: ApiKeyDetail["lastUsedAt"];
  permission: ApiKeyDetail["permission"];
  domain: string | null;
};

export type ApiKeyPublicCreateResponse = {
  id: string;
  token: string;
};

export type CreateApiKeyInput = {
  name: string;
  permission?: ApiKeyPermission;
  domainId?: string;
  userId?: string;
};

export type CreateApiKeyResult = {
  id: string;
  token: string;
  tokenHash: string;
};

export type DeleteApiKeyResult = {
  id: string;
  tokenHash: string;
};

export type ApiKeyServiceErrorCode =
  | "invalid_name"
  | "name_too_long"
  | "not_found";

export class ApiKeyServiceError extends Error {
  constructor(
    readonly code: ApiKeyServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiKeyServiceError";
  }
}

export type ApiKeyRepository = {
  list(options: { userId: string; limit?: number; after?: string }): Promise<{
    data: ApiKeyRow[];
    hasMore: boolean;
  }>;
  create(data: ApiKeyInsert): Promise<ApiKeyRow[]>;
  findById(id: string, userId: string): Promise<ApiKeyRow | undefined>;
  delete(id: string, userId: string): Promise<Array<{ id: string }>>;
};

export type ApiKeyServiceDependencies = {
  repository?: ApiKeyRepository;
  generateRawKey?: () => string;
  invalidateAuthCache?: (tokenHash: string) => Promise<void>;
};

function defaultGenerateRawKey(): string {
  return `re_${randomUUID().replace(/-/g, "")}`;
}

function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

function previewApiKey(rawKey: string): string {
  return `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}`;
}

function normalizeLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit || 20, 1), 100);
}

export function parseCreateApiKeyBody(body: unknown): {
  name: string;
  permission?: ApiKeyPermission;
  domainId?: string;
} {
  const data =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const record = data as Record<string, unknown>;
  const permission = record.permission;
  const domainId = record.domain_id;

  return {
    name: typeof record.name === "string" ? record.name : "",
    permission:
      permission === "full_access" || permission === "sending_access"
        ? permission
        : undefined,
    domainId: typeof domainId === "string" ? domainId : undefined,
  };
}

export function toApiKeyListResponse(
  result: ApiKeyListResult,
): ApiKeyPublicListResponse {
  return {
    object: "list",
    data: result.data.map((key) => ({
      id: key.id,
      name: key.name,
      created_at: key.createdAt,
      last_used_at: key.lastUsedAt,
      permission: key.permission,
      domain: key.domain,
    })),
    has_more: result.hasMore,
  };
}

export function toApiKeyDetailResponse(
  key: ApiKeyDetail,
): ApiKeyPublicDetailResponse {
  return {
    object: "api_key",
    id: key.id,
    name: key.name,
    created_at: key.createdAt,
    last_used_at: key.lastUsedAt,
    permission: key.permission,
    domain: key.domain,
  };
}

export function toApiKeyCreateResponse(
  created: CreateApiKeyResult,
): ApiKeyPublicCreateResponse {
  return {
    id: created.id,
    token: created.token,
  };
}

export function createApiKeyService({
  repository = apiKeyRepo,
  generateRawKey = defaultGenerateRawKey,
  invalidateAuthCache = async () => {},
}: ApiKeyServiceDependencies = {}) {
  return {
    async listApiKeys(options: {
      userId: string;
      limit?: number;
      after?: string;
    }): Promise<ApiKeyListResult> {
      const result = await repository.list({
        userId: options.userId,
        limit: normalizeLimit(options.limit),
        after: options.after || undefined,
      });

      return {
        data: result.data.map((key) => ({
          id: key.id,
          name: key.name,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          permission: key.permission,
          domain: key.domain,
        })),
        hasMore: result.hasMore,
      };
    },

    async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
      const name = input.name.trim();
      if (!name) {
        throw new ApiKeyServiceError("invalid_name", "name is required");
      }

      if (name.length > 50) {
        throw new ApiKeyServiceError(
          "name_too_long",
          "name must be 50 characters or less",
        );
      }

      const rawKey = generateRawKey();
      const tokenHash = hashApiKey(rawKey);
      const [created] = await repository.create({
        name,
        tokenHash,
        tokenPreview: previewApiKey(rawKey),
        permission: input.permission ?? "full_access",
        domain: input.domainId ?? null,
        userId: input.userId ?? null,
      });

      await invalidateAuthCache(created.tokenHash);

      return {
        id: created.id,
        token: rawKey,
        tokenHash: created.tokenHash,
      };
    },

    async getApiKey(id: string, userId: string): Promise<ApiKeyDetail> {
      const key = await repository.findById(id, userId);
      if (!key) {
        throw new ApiKeyServiceError("not_found", "API key not found");
      }

      return {
        id: key.id,
        name: key.name,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        permission: key.permission,
        domain: key.domain,
      };
    },

    async deleteApiKey(
      id: string,
      userId: string,
    ): Promise<DeleteApiKeyResult> {
      const existing = await repository.findById(id, userId);
      if (!existing) {
        throw new ApiKeyServiceError("not_found", "API key not found");
      }

      const [deleted] = await repository.delete(id, userId);
      await invalidateAuthCache(existing.tokenHash);

      return {
        id: deleted?.id ?? id,
        tokenHash: existing.tokenHash,
      };
    },
  };
}

export const apiKeyService = createApiKeyService();
