import { describe, expect, it } from "vitest";
import {
  type AudienceMetadataRepository,
  type AudienceMetadataServiceError,
  createAudienceMetadataService,
} from "../packages/core/src/services/audience-metadata";

type SegmentRow = NonNullable<
  Awaited<ReturnType<AudienceMetadataRepository["findSegmentByIdForUser"]>>
>;
type TopicRow = NonNullable<
  Awaited<ReturnType<AudienceMetadataRepository["findTopicByIdForUser"]>>
>;
type PropertyRow = NonNullable<
  Awaited<ReturnType<AudienceMetadataRepository["findPropertyByIdForUser"]>>
>;
type SegmentContactRow = Awaited<
  ReturnType<AudienceMetadataRepository["listSegmentContactsForApi"]>
>["data"][number] & { segmentId: string; userId: string };

const baseDate = new Date("2026-05-10T00:00:00.000Z");
const updatedDate = new Date("2026-05-10T01:00:00.000Z");

function makeRepository(seed?: {
  segments?: SegmentRow[];
  segmentContacts?: SegmentContactRow[];
  topics?: TopicRow[];
  properties?: PropertyRow[];
}): AudienceMetadataRepository {
  const segments = [...(seed?.segments ?? [])];
  const segmentContacts = [...(seed?.segmentContacts ?? [])];
  const topics = [...(seed?.topics ?? [])];
  const properties = [...(seed?.properties ?? [])];

  return {
    async listSegmentsForApi(options) {
      const filtered = segments
        .filter((segment) => segment.userId === options.userId)
        .filter((segment) =>
          options.search
            ? segment.name.toLowerCase().includes(options.search.toLowerCase())
            : true,
        )
        .filter((segment) =>
          options.after ? segment.id < options.after : true,
        )
        .sort((a, b) => b.id.localeCompare(a.id));
      return {
        data: filtered.slice(0, options.limit),
        hasMore: filtered.length > options.limit,
        total: filtered.length,
      };
    },
    async createSegment(data) {
      const segment: SegmentRow = {
        id: `seg-${segments.length + 1}`,
        name: data.name,
        contactsCount: data.contactsCount ?? 0,
        unsubscribedCount: data.unsubscribedCount ?? 0,
        createdAt: baseDate,
        document: data.document ?? null,
        userId: data.userId ?? null,
      };
      segments.push(segment);
      return [segment];
    },
    async findSegmentByIdForUser(id, userId) {
      return segments.find(
        (segment) => segment.id === id && segment.userId === userId,
      );
    },
    async deleteSegmentForUser(id, userId) {
      const index = segments.findIndex(
        (segment) => segment.id === id && segment.userId === userId,
      );
      if (index === -1) return [];
      return segments.splice(index, 1);
    },
    async listSegmentContactsForApi(options) {
      const filtered = segmentContacts
        .filter(
          (contact) =>
            contact.userId === options.userId &&
            contact.segmentId === options.segmentId,
        )
        .filter((contact) =>
          options.after ? contact.id < options.after : true,
        )
        .sort((a, b) => b.id.localeCompare(a.id));
      return {
        data: filtered.slice(0, options.limit),
        hasMore: filtered.length > options.limit,
      };
    },

    async listTopicsForApi(options) {
      const filtered = topics
        .filter((topic) => topic.userId === options.userId)
        .filter((topic) =>
          options.search
            ? topic.name.toLowerCase().includes(options.search.toLowerCase())
            : true,
        )
        .filter((topic) => (options.after ? topic.id < options.after : true))
        .sort((a, b) => b.id.localeCompare(a.id));
      return {
        data: filtered.slice(0, options.limit),
        hasMore: filtered.length > options.limit,
        total: filtered.length,
      };
    },
    async createTopic(data) {
      const topic: TopicRow = {
        id: `topic-${topics.length + 1}`,
        name: data.name,
        description: data.description ?? null,
        defaultSubscription: data.defaultSubscription ?? "opt_out",
        visibility: data.visibility ?? "public",
        createdAt: baseDate,
        document: data.document ?? null,
        userId: data.userId ?? null,
      };
      topics.push(topic);
      return [topic];
    },
    async findTopicByIdForUser(id, userId) {
      return topics.find((topic) => topic.id === id && topic.userId === userId);
    },
    async updateTopicForUser(id, userId, data) {
      const topic = topics.find(
        (existing) => existing.id === id && existing.userId === userId,
      );
      if (!topic) return [];
      Object.assign(topic, data);
      return [topic];
    },
    async deleteTopicForUser(id, userId) {
      const index = topics.findIndex(
        (topic) => topic.id === id && topic.userId === userId,
      );
      if (index === -1) return [];
      return topics.splice(index, 1);
    },

    async listPropertiesForApi(options) {
      const filtered = properties
        .filter((property) => property.userId === options.userId)
        .filter((property) =>
          options.search
            ? property.key
                .toLowerCase()
                .includes(options.search.toLowerCase()) ||
              property.name.toLowerCase().includes(options.search.toLowerCase())
            : true,
        )
        .filter((property) =>
          options.type ? property.type === options.type : true,
        )
        .sort((a, b) => a.key.localeCompare(b.key));
      const offset = (options.page - 1) * options.limit;
      return {
        data: filtered.slice(offset, offset + options.limit),
        total: filtered.length,
      };
    },
    async createProperty(data) {
      const property: PropertyRow = {
        id: `prop-${properties.length + 1}`,
        key: data.key,
        name: data.name,
        type: data.type ?? "string",
        fallbackValue: data.fallbackValue ?? null,
        createdAt: baseDate,
        updatedAt: baseDate,
        document: data.document ?? null,
        userId: data.userId ?? null,
      };
      properties.push(property);
      return [property];
    },
    async findPropertyByIdForUser(id, userId) {
      return properties.find(
        (property) => property.id === id && property.userId === userId,
      );
    },
    async updatePropertyForUser(id, userId, data) {
      const property = properties.find(
        (existing) => existing.id === id && existing.userId === userId,
      );
      if (!property) return [];
      Object.assign(property, data);
      return [property];
    },
    async deletePropertyForUser(id, userId) {
      const index = properties.findIndex(
        (property) => property.id === id && property.userId === userId,
      );
      if (index === -1) return [];
      return properties.splice(index, 1);
    },
  };
}

function segment(id: string, name: string, userId: string): SegmentRow {
  return {
    id,
    name,
    contactsCount: 0,
    unsubscribedCount: 0,
    createdAt: baseDate,
    document: null,
    userId,
  };
}

function topic(id: string, name: string, userId: string): TopicRow {
  return {
    id,
    name,
    description: null,
    defaultSubscription: "opt_out",
    visibility: "public",
    createdAt: baseDate,
    document: null,
    userId,
  };
}

function property(
  id: string,
  key: string,
  userId: string,
  overrides: Partial<PropertyRow> = {},
): PropertyRow {
  return {
    id,
    key,
    name: key,
    type: "string",
    fallbackValue: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    document: null,
    userId,
    ...overrides,
  };
}

function segmentContact(
  id: string,
  email: string,
  userId: string,
  segmentId: string,
  unsubscribed = false,
): SegmentContactRow {
  return {
    id,
    email,
    firstName: "First",
    lastName: "Last",
    unsubscribed,
    createdAt: baseDate,
    segmentId,
    userId,
  };
}

describe("audience metadata service", () => {
  it("lists segments with tenant isolation, search, pagination, and response shape", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        segments: [
          segment("seg-c", "VIP Customers", "user-1"),
          segment("seg-b", "VIP Prospects", "user-1"),
          segment("seg-a", "VIP Other Tenant", "user-2"),
        ],
      }),
    });

    await expect(
      service.listSegments({ userId: "user-1", search: "vip", limit: 1 }),
    ).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "seg-c",
          name: "VIP Customers",
          created_at: baseDate,
          contacts_count: 0,
          unsubscribed_count: 0,
        },
      ],
      has_more: true,
      total: 2,
    });
  });

  it("creates topics with legacy defaults and validates name/description", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository(),
    });

    await expect(
      service.createTopic({ userId: "user-1", body: { name: "   " } }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Name is required",
      status: 400,
    } satisfies Partial<AudienceMetadataServiceError>);

    await expect(
      service.createTopic({
        userId: "user-1",
        body: { name: "News", description: "x".repeat(201) },
      }),
    ).rejects.toMatchObject({
      message: "Description must be 200 characters or less",
      status: 422,
    });

    await expect(
      service.createTopic({
        userId: "user-1",
        body: {
          name: " Product ",
          description: " updates ",
          default_subscription: "opt_in",
          visibility: "private",
        },
      }),
    ).resolves.toMatchObject({
      object: "topic",
      name: "Product",
      description: "updates",
      defaultSubscription: "opt_in",
      visibility: "private",
    });

    await expect(
      service.createTopic({
        userId: "user-1",
        body: {
          name: "Product 2",
        },
      }),
    ).resolves.toMatchObject({
      object: "topic",
      name: "Product 2",
      defaultSubscription: "opt_out",
      visibility: "public",
    });
  });

  it("enforces strict root validation for topics", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository(),
    });

    await expect(
      service.createTopic({
        userId: "user-1",
        mode: "root",
        body: {
          name: " Product ",
          description: " updates ",
          visibility: "private",
        },
      }),
    ).rejects.toMatchObject({
      message: "default_subscription is required",
      status: 400,
    });

    await expect(
      service.createTopic({
        userId: "user-1",
        mode: "root",
        body: {
          name: " Product ",
          default_subscription: "opt_in",
        },
      }),
    ).rejects.toMatchObject({
      message: "visibility is required",
      status: 400,
    });

    await expect(
      service.createTopic({
        userId: "user-1",
        mode: "root",
        body: {
          name: " Product ",
          default_subscription: "oops",
          visibility: "private",
        },
      }),
    ).rejects.toMatchObject({
      message: "default_subscription must be one of: opt_in | opt_out",
      status: 422,
    });
  });

  it("rejects root topic default subscription updates because defaults are creation-time only", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        topics: [topic("topic-1", "News", "user-1")],
      }),
    });

    await expect(
      service.updateTopic({
        userId: "user-1",
        mode: "root",
        id: "topic-1",
        body: {
          default_subscription: "opt_in",
        },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "default_subscription cannot be changed after topic creation",
      status: 400,
    } satisfies Partial<AudienceMetadataServiceError>);
  });

  it("supports root-detail topic PATCH validation without requiring omitted enum fields", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        topics: [topic("topic-1", "News", "user-1")],
      }),
    });

    await expect(
      service.updateTopic({
        userId: "user-1",
        mode: "root",
        id: "topic-1",
        body: {
          visibility: "private",
        },
      }),
    ).resolves.toMatchObject({
      id: "topic-1",
      defaultSubscription: "opt_out",
      visibility: "private",
    });

    await expect(
      service.updateTopic({
        userId: "user-1",
        mode: "root",
        id: "topic-1",
        body: {
          default_subscription: "yes",
        },
      }),
    ).rejects.toMatchObject({
      message: "default_subscription cannot be changed after topic creation",
      status: 400,
    });

    await expect(
      service.updateTopic({
        userId: "user-1",
        mode: "root",
        id: "topic-1",
        body: {
          visibility: "open",
        },
      }),
    ).rejects.toMatchObject({
      message: "visibility must be one of: public | private",
      status: 422,
    });
  });

  it("preserves API-mode topic update fallback semantics", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        topics: [topic("topic-1", "News", "user-1")],
      }),
    });

    await expect(
      service.updateTopic({
        userId: "user-1",
        mode: "api",
        id: "topic-1",
        body: {
          default_subscription: "definitely-not-valid",
          visibility: "locked",
        },
      }),
    ).resolves.toMatchObject({
      id: "topic-1",
      defaultSubscription: "opt_out",
      visibility: "public",
    });
  });

  it("returns not found instead of crossing tenants for detail and mutation", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        topics: [topic("topic-1", "News", "user-1")],
      }),
    });

    await expect(
      service.getTopic({ userId: "user-2", id: "topic-1" }),
    ).rejects.toMatchObject({ message: "Topic not found", status: 404 });

    await expect(
      service.deleteTopic({ userId: "user-2", id: "topic-1" }),
    ).rejects.toMatchObject({ message: "Topic not found", status: 404 });
  });

  it("lists segment contacts with segment tenant check, cursor pagination, and response shape", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        segments: [segment("seg-1", "VIP", "user-1")],
        segmentContacts: [
          segmentContact("contact-c", "c@example.com", "user-1", "seg-1"),
          segmentContact("contact-b", "b@example.com", "user-1", "seg-1", true),
          segmentContact("contact-a", "a@example.com", "user-1", "seg-1"),
          segmentContact("contact-z", "z@example.com", "user-2", "seg-1"),
        ],
      }),
    });

    await expect(
      service.listSegmentContacts({
        userId: "user-1",
        segmentId: "seg-1",
        after: "contact-c",
        limit: 1,
      }),
    ).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "contact-b",
          email: "b@example.com",
          firstName: "First",
          lastName: "Last",
          status: "unsubscribed",
          created_at: baseDate,
        },
      ],
      has_more: true,
    });

    await expect(
      service.listSegmentContacts({
        userId: "user-2",
        segmentId: "seg-1",
      }),
    ).rejects.toMatchObject({ message: "Segment not found", status: 404 });
  });

  it("lists and creates properties with tenant isolation, filters, key generation, and page metadata", async () => {
    const repository = makeRepository({
      properties: [
        property("prop-b", "company", "user-1"),
        property("prop-c", "company_size", "user-1", { type: "number" }),
        property("prop-a", "external", "user-2"),
      ],
    });
    const service = createAudienceMetadataService({ repository });

    await expect(
      service.listProperties({
        userId: "user-1",
        page: 1,
        limit: 20,
        search: "company",
        type: "string",
      }),
    ).resolves.toEqual({
      data: [
        {
          id: "prop-b",
          key: "company",
          name: "company",
          type: "string",
          fallback_value: null,
          created_at: baseDate,
          updated_at: baseDate,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    await expect(
      service.createProperty({
        userId: "user-1",
        body: { name: "Company Size", type: "number", fallback_value: 0 },
      }),
    ).resolves.toMatchObject({
      object: "contact_property",
      key: "company_size",
      name: "Company Size",
      type: "number",
      fallback_value: null,
    });

    await expect(
      service.createProperty({
        userId: "user-1",
        body: { name: "Company Type" },
      }),
    ).resolves.toMatchObject({
      object: "contact_property",
      key: "company_type",
      type: "string",
    });

    await expect(
      service.createProperty({
        userId: "user-1",
        mode: "root",
        body: {
          name: "Company Type",
          type: "string",
        },
      }),
    ).rejects.toMatchObject({ message: "key is required", status: 400 });

    await expect(
      service.createProperty({
        userId: "user-1",
        mode: "root",
        body: {
          name: "Company Type",
          key: "company_type",
        },
      }),
    ).rejects.toMatchObject({ message: "type is required", status: 400 });

    await expect(
      service.createProperty({
        userId: "user-1",
        mode: "root",
        body: {
          name: "Company Type",
          key: "company_type",
          type: "text",
        },
      }),
    ).rejects.toMatchObject({
      message: "type must be one of: string | number | boolean | date",
      status: 422,
    });
  });

  it("enforces strict root validation for property PATCH type", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        properties: [property("prop-1", "company", "user-1")],
      }),
    });

    await expect(
      service.updateProperty({
        userId: "user-1",
        mode: "root",
        id: "prop-1",
        body: {
          type: "text",
        },
      }),
    ).rejects.toMatchObject({
      message: "type must be one of: string | number | boolean | date",
      status: 422,
    });
  });

  it("preserves API-mode property patch semantics", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        properties: [property("prop-1", "company", "user-1")],
      }),
    });

    await expect(
      service.updateProperty({
        userId: "user-1",
        mode: "api",
        id: "prop-1",
        body: {
          type: 123,
        },
      }),
    ).resolves.toMatchObject({
      id: "prop-1",
      type: "123",
    });
  });

  it("preserves property patch semantics by updating timestamp even for empty bodies", async () => {
    const service = createAudienceMetadataService({
      repository: makeRepository({
        properties: [property("prop-1", "company", "user-1")],
      }),
      now: () => updatedDate,
    });

    await expect(
      service.updateProperty({ userId: "user-1", id: "prop-1", body: {} }),
    ).resolves.toMatchObject({
      id: "prop-1",
      updated_at: updatedDate,
    });
  });
});
