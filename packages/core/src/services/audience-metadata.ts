import { propertyRepo } from "../db/repositories/propertyRepo";
import { segmentRepo } from "../db/repositories/segmentRepo";
import { topicRepo } from "../db/repositories/topicRepo";
import type {
  contactProperties,
  contacts,
  segments,
  topics,
} from "../db/schema";

type SegmentRow = typeof segments.$inferSelect;
type SegmentInsert = typeof segments.$inferInsert;
type TopicRow = typeof topics.$inferSelect;
type TopicInsert = typeof topics.$inferInsert;
type PropertyRow = typeof contactProperties.$inferSelect;
type PropertyInsert = typeof contactProperties.$inferInsert;
type ContactRow = typeof contacts.$inferSelect;

type ApiCompatibilityMode = "api" | "root";

const validTopicDefaultSubscriptions = ["opt_in", "opt_out"] as const;
const validTopicVisibilities = ["public", "private"] as const;
const validPropertyTypes = ["string", "number", "boolean", "date"] as const;

type TopicDefaultSubscription = (typeof validTopicDefaultSubscriptions)[number];
type TopicVisibility = (typeof validTopicVisibilities)[number];
type PropertyType = (typeof validPropertyTypes)[number];

type CreateTopicInput = {
  userId: string;
  body: unknown;
  mode?: ApiCompatibilityMode;
};

type CreatePropertyInput = {
  userId: string;
  body: unknown;
  mode?: ApiCompatibilityMode;
};

type SegmentListRow = Pick<SegmentRow, "id" | "name" | "createdAt">;
type SegmentContactListRow = Pick<
  ContactRow,
  "id" | "email" | "firstName" | "lastName" | "unsubscribed" | "createdAt"
>;
type TopicListRow = Pick<
  TopicRow,
  | "id"
  | "name"
  | "description"
  | "defaultSubscription"
  | "visibility"
  | "createdAt"
>;
type PropertyListRow = Pick<
  PropertyRow,
  "id" | "key" | "name" | "type" | "fallbackValue" | "createdAt" | "updatedAt"
>;

export type AudienceMetadataRepository = {
  listSegmentsForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    search?: string;
  }): Promise<{ data: SegmentListRow[]; hasMore: boolean; total: number }>;
  createSegment(data: SegmentInsert): Promise<SegmentRow[]>;
  findSegmentByIdForUser(
    id: string,
    userId: string,
  ): Promise<SegmentRow | undefined>;
  deleteSegmentForUser(id: string, userId: string): Promise<SegmentRow[]>;
  listSegmentContactsForApi(options: {
    userId: string;
    segmentId: string;
    limit: number;
    after?: string;
  }): Promise<{ data: SegmentContactListRow[]; hasMore: boolean }>;

  listTopicsForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    search?: string;
  }): Promise<{ data: TopicListRow[]; hasMore: boolean; total: number }>;
  createTopic(data: TopicInsert): Promise<TopicRow[]>;
  findTopicByIdForUser(
    id: string,
    userId: string,
  ): Promise<TopicRow | undefined>;
  updateTopicForUser(
    id: string,
    userId: string,
    data: Partial<TopicInsert>,
  ): Promise<TopicRow[]>;
  deleteTopicForUser(id: string, userId: string): Promise<TopicRow[]>;

  listPropertiesForApi(options: {
    userId: string;
    page: number;
    limit: number;
  }): Promise<{ data: PropertyListRow[]; total: number }>;
  createProperty(data: PropertyInsert): Promise<PropertyRow[]>;
  findPropertyByIdForUser(
    id: string,
    userId: string,
  ): Promise<PropertyRow | undefined>;
  updatePropertyForUser(
    id: string,
    userId: string,
    data: Partial<PropertyInsert>,
  ): Promise<PropertyRow[]>;
  deletePropertyForUser(id: string, userId: string): Promise<PropertyRow[]>;
};

export type AudienceMetadataServiceDependencies = {
  repository?: AudienceMetadataRepository;
  now?: () => Date;
};

export type AudienceMetadataServiceErrorCode = "invalid_input" | "not_found";

export class AudienceMetadataServiceError extends Error {
  constructor(
    readonly code: AudienceMetadataServiceErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AudienceMetadataServiceError";
  }
}

function defaultRepository(): AudienceMetadataRepository {
  return {
    listSegmentsForApi: (options) => segmentRepo.listForApi(options),
    createSegment: (data) => segmentRepo.create(data),
    findSegmentByIdForUser: (id, userId) =>
      segmentRepo.findByIdForUser(id, userId),
    deleteSegmentForUser: (id, userId) => segmentRepo.deleteForUser(id, userId),
    listSegmentContactsForApi: (options) =>
      segmentRepo.listContactsForApi(options),

    listTopicsForApi: (options) => topicRepo.listForApi(options),
    createTopic: (data) => topicRepo.create(data),
    findTopicByIdForUser: (id, userId) => topicRepo.findByIdForUser(id, userId),
    updateTopicForUser: (id, userId, data) =>
      topicRepo.updateForUser(id, userId, data),
    deleteTopicForUser: (id, userId) => topicRepo.deleteForUser(id, userId),

    listPropertiesForApi: (options) => propertyRepo.listForApi(options),
    createProperty: (data) => propertyRepo.create(data),
    findPropertyByIdForUser: (id, userId) =>
      propertyRepo.findByIdForUser(id, userId),
    updatePropertyForUser: (id, userId, data) =>
      propertyRepo.updateForUser(id, userId, data),
    deletePropertyForUser: (id, userId) =>
      propertyRepo.deleteForUser(id, userId),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeLimit(value: number | undefined, fallback: number): number {
  return Math.min(100, Math.max(1, value || fallback));
}

function normalizePage(value: number | undefined): number {
  return Math.max(1, value || 1);
}

function trimRequiredString(value: unknown, field: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new TypeError(`${field}.trim is not a function`);
  }
  return value.trim();
}

function trimPresentString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${field}.trim is not a function`);
  }
  return value.trim();
}

function trimOptionalStringAsNull(
  value: unknown,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  return trimPresentString(value, field) || null;
}

function firstTruthyString(...values: unknown[]): string | null {
  const found = values.find(Boolean);
  return found === undefined || found === null ? null : String(found);
}

function assertStrictEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== "string") {
    throw invalidInput(`${field} is required`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw invalidInput(`${field} is required`);
  }

  if (!allowed.includes(normalized as T[number])) {
    throw invalidInput(`${field} must be one of: ${allowed.join(" | ")}`, 422);
  }

  return normalized as T[number];
}

function toSegmentListItem(row: SegmentListRow) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt,
  };
}

function toSegmentDetail(row: SegmentRow) {
  return {
    object: "segment" as const,
    id: row.id,
    name: row.name,
    created_at: row.createdAt,
  };
}

function toSegmentContactListItem(row: SegmentContactListRow) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.unsubscribed ? "unsubscribed" : "subscribed",
    created_at: row.createdAt,
  };
}

function toTopicListItem(row: TopicListRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    default_subscription: row.defaultSubscription,
    visibility: row.visibility,
    created_at: row.createdAt,
  };
}

function toTopicDetail(row: TopicRow) {
  return {
    object: "topic" as const,
    id: row.id,
    name: row.name,
    description: row.description,
    default_subscription: row.defaultSubscription,
    visibility: row.visibility,
    created_at: row.createdAt,
  };
}

function toPropertyPayload(row: PropertyListRow | PropertyRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    type: row.type,
    fallback_value: row.fallbackValue,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

function notFound(message: string): AudienceMetadataServiceError {
  return new AudienceMetadataServiceError("not_found", message, 404);
}

function invalidInput(
  message: string,
  status = 400,
): AudienceMetadataServiceError {
  return new AudienceMetadataServiceError("invalid_input", message, status);
}

export function createAudienceMetadataService({
  repository = defaultRepository(),
  now = () => new Date(),
}: AudienceMetadataServiceDependencies = {}) {
  return {
    async listSegments(input: {
      userId: string;
      limit?: number;
      after?: string;
      search?: string;
    }) {
      const result = await repository.listSegmentsForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit, 20),
        after: input.after || undefined,
        search: input.search?.trim() || undefined,
      });

      return {
        object: "list" as const,
        data: result.data.map(toSegmentListItem),
        has_more: result.hasMore,
        total: result.total,
      };
    },

    async createSegment(input: { userId: string; body: unknown }) {
      const body = asRecord(input.body);
      const name = trimRequiredString(body.name, "name");
      if (!name) throw invalidInput("Name is required");

      const [segment] = await repository.createSegment({
        name,
        userId: input.userId,
      });

      return {
        object: "segment" as const,
        id: segment.id,
        name: segment.name,
      };
    },

    async getSegment(input: { userId: string; id: string }) {
      const segment = await repository.findSegmentByIdForUser(
        input.id,
        input.userId,
      );
      if (!segment) throw notFound("Segment not found");
      return toSegmentDetail(segment);
    },

    async deleteSegment(input: { userId: string; id: string }) {
      const [deleted] = await repository.deleteSegmentForUser(
        input.id,
        input.userId,
      );
      if (!deleted) throw notFound("Segment not found");
    },

    async listSegmentContacts(input: {
      userId: string;
      segmentId: string;
      limit?: number;
      after?: string;
    }) {
      const segment = await repository.findSegmentByIdForUser(
        input.segmentId,
        input.userId,
      );
      if (!segment) throw notFound("Segment not found");

      const result = await repository.listSegmentContactsForApi({
        userId: input.userId,
        segmentId: input.segmentId,
        limit: normalizeLimit(input.limit, 20),
        after: input.after || undefined,
      });

      return {
        object: "list" as const,
        data: result.data.map(toSegmentContactListItem),
        has_more: result.hasMore,
      };
    },

    async listTopics(input: {
      userId: string;
      limit?: number;
      after?: string;
      search?: string;
    }) {
      const result = await repository.listTopicsForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit, 20),
        after: input.after || undefined,
        search: input.search?.trim() || undefined,
      });

      return {
        object: "list" as const,
        data: result.data.map(toTopicListItem),
        has_more: result.hasMore,
        total: result.total,
      };
    },

    async createTopic(input: CreateTopicInput) {
      const body = asRecord(input.body);
      const name = trimRequiredString(body.name, "name");
      if (!name) throw invalidInput("Name is required");

      const description = trimOptionalStringAsNull(
        body.description,
        "description",
      );
      if (description && description.length > 200) {
        throw invalidInput("Description must be 200 characters or less", 422);
      }

      const mode = input.mode === "root" ? "root" : "api";

      const defaultSubscriptionRaw =
        body.default_subscription ?? body.defaultSubscription;
      const visibilityRaw = body.visibility;

      const defaultSubscription: TopicDefaultSubscription =
        mode === "root"
          ? (assertStrictEnumValue(
              defaultSubscriptionRaw,
              validTopicDefaultSubscriptions,
              "default_subscription",
            ) as TopicDefaultSubscription)
          : defaultSubscriptionRaw === "opt_in"
            ? "opt_in"
            : "opt_out";

      const visibility: TopicVisibility =
        mode === "root"
          ? (assertStrictEnumValue(
              visibilityRaw,
              validTopicVisibilities,
              "visibility",
            ) as TopicVisibility)
          : visibilityRaw === "private"
            ? "private"
            : "public";

      const [topic] = await repository.createTopic({
        name,
        description,
        defaultSubscription,
        visibility,
        userId: input.userId,
      });

      return {
        object: "topic" as const,
        id: topic.id,
        name: topic.name,
        description: topic.description,
        defaultSubscription: topic.defaultSubscription,
        visibility: topic.visibility,
        createdAt: topic.createdAt,
      };
    },

    async getTopic(input: { userId: string; id: string }) {
      const topic = await repository.findTopicByIdForUser(
        input.id,
        input.userId,
      );
      if (!topic) throw notFound("Topic not found");
      return toTopicDetail(topic);
    },

    async updateTopic(input: { userId: string; id: string; body: unknown }) {
      const body = asRecord(input.body);
      const updateData: Partial<TopicInsert> = {};

      if (body.name !== undefined) {
        updateData.name = trimPresentString(body.name, "name");
      }
      if (body.description !== undefined) {
        updateData.description = trimOptionalStringAsNull(
          body.description,
          "description",
        );
      }
      if (body.defaultSubscription !== undefined) {
        updateData.defaultSubscription =
          body.defaultSubscription === "opt_in" ? "opt_in" : "opt_out";
      }
      if (body.visibility !== undefined) {
        updateData.visibility =
          body.visibility === "private" ? "private" : "public";
      }

      if (Object.keys(updateData).length === 0) {
        throw invalidInput("No fields to update");
      }

      const [updated] = await repository.updateTopicForUser(
        input.id,
        input.userId,
        updateData,
      );
      if (!updated) throw notFound("Topic not found");
      return updated;
    },

    async deleteTopic(input: { userId: string; id: string }) {
      const [deleted] = await repository.deleteTopicForUser(
        input.id,
        input.userId,
      );
      if (!deleted) throw notFound("Topic not found");
    },

    async listProperties(input: {
      userId: string;
      page?: number;
      limit?: number;
    }) {
      const page = normalizePage(input.page);
      const limit = normalizeLimit(input.limit, 20);
      const result = await repository.listPropertiesForApi({
        userId: input.userId,
        page,
        limit,
      });

      return {
        data: result.data.map(toPropertyPayload),
        total: result.total,
        page,
        limit,
      };
    },

    async createProperty(input: CreatePropertyInput) {
      const body = asRecord(input.body);
      const mode = input.mode === "root" ? "root" : "api";

      const key =
        mode === "root"
          ? trimRequiredString(body.key, "key")
          : trimOptionalStringAsNull(body.key, "key") || "";

      if (mode === "root" && !key) {
        throw invalidInput("key is required");
      }
      const name = trimRequiredString(body.name, "name");
      const type =
        mode === "root"
          ? (assertStrictEnumValue(
              body.type,
              validPropertyTypes,
              "type",
            ) as PropertyType)
          : (firstTruthyString(body.type) ?? "string");
      const fallbackValue = firstTruthyString(
        body.fallback_value,
        body.fallbackValue,
      );

      if (!name) throw invalidInput("Name is required");

      const finalKey = key || name.toLowerCase().replace(/[^a-z0-9_]/g, "_");

      const [property] = await repository.createProperty({
        key: finalKey,
        name,
        type,
        fallbackValue,
        userId: input.userId,
      });

      return {
        object: "contact_property" as const,
        ...toPropertyPayload(property),
      };
    },

    async getProperty(input: { userId: string; id: string }) {
      const property = await repository.findPropertyByIdForUser(
        input.id,
        input.userId,
      );
      if (!property) throw notFound("Contact property not found");
      return toPropertyPayload(property);
    },

    async updateProperty(input: { userId: string; id: string; body: unknown }) {
      const body = asRecord(input.body);
      const updateData: Partial<PropertyInsert> = { updatedAt: now() };

      if (body.name !== undefined) {
        updateData.name = trimPresentString(body.name, "name");
      }
      if (body.type !== undefined) {
        updateData.type = String(body.type);
      }
      if (body.fallback_value !== undefined) {
        updateData.fallbackValue =
          body.fallback_value === null ? null : String(body.fallback_value);
      }

      const [updated] = await repository.updatePropertyForUser(
        input.id,
        input.userId,
        updateData,
      );
      if (!updated) throw notFound("Contact property not found");
      return toPropertyPayload(updated);
    },

    async deleteProperty(input: { userId: string; id: string }) {
      const [deleted] = await repository.deletePropertyForUser(
        input.id,
        input.userId,
      );
      if (!deleted) throw notFound("Contact property not found");
    },
  };
}
