import { describe, expect, it, vi } from "vitest";
import {
  type ContactRepository,
  type ContactServiceError,
  createContactService,
} from "../packages/core/src/services/contact";

type ContactRow = NonNullable<
  Awaited<ReturnType<ContactRepository["findByIdOrEmailForUser"]>>
>;
type SegmentRow = NonNullable<
  Awaited<ReturnType<ContactRepository["findSegmentByIdForUser"]>>
>;
type TopicRow = NonNullable<
  Awaited<ReturnType<ContactRepository["findTopicByIdForUser"]>>
>;
type ContactInsert = Parameters<ContactRepository["create"]>[0];

const createdAt = new Date("2026-05-10T00:00:00.000Z");

function contactRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: "contact-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    unsubscribed: false,
    customProperties: { plan: "pro" },
    segments: ["VIP"],
    topicSubscriptions: [{ topicId: "topic-1", subscribed: true }],
    createdAt,
    document: null,
    userId: "user-1",
    ...overrides,
  };
}

function segmentRow(overrides: Partial<SegmentRow> = {}): SegmentRow {
  return {
    id: "segment-1",
    name: "VIP",
    contactsCount: 0,
    unsubscribedCount: 0,
    createdAt,
    document: null,
    userId: "user-1",
    ...overrides,
  };
}

function topicRow(overrides: Partial<TopicRow> = {}): TopicRow {
  return {
    id: "topic-1",
    name: "Product Updates",
    description: null,
    defaultSubscription: "opt_out",
    visibility: "public",
    createdAt,
    document: null,
    userId: "user-1",
    ...overrides,
  };
}

function createRepository(
  overrides: Partial<ContactRepository> = {},
): ContactRepository {
  return {
    async findByIdOrEmailForUser() {
      return contactRow();
    },
    async create(data: ContactInsert) {
      return [
        contactRow({
          email: data.email,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          unsubscribed: data.unsubscribed ?? false,
          customProperties: data.customProperties ?? null,
          segments: data.segments ?? null,
          topicSubscriptions: data.topicSubscriptions ?? null,
          userId: data.userId ?? null,
        }),
      ];
    },
    async updateForUser(_id, _userId, data) {
      return [contactRow(data as Partial<ContactRow>)];
    },
    async deleteForUser(id) {
      return [{ id, email: "user@example.com" }];
    },
    async listForApi() {
      return { data: [contactRow()], hasMore: false };
    },
    async findSegmentByIdForUser() {
      return segmentRow();
    },
    async findSegmentByIdOrNameForUser() {
      return segmentRow();
    },
    async findSegmentsByNamesForUser(names) {
      return names.map((name, index) => ({
        id: `segment-${index + 1}`,
        name,
        createdAt,
      }));
    },
    async findTopicByIdForUser() {
      return topicRow();
    },
    async findTopicsByIdsForUser(ids) {
      return ids.map((id, index) =>
        topicRow({ id, name: index === 0 ? "Product Updates" : "Changelog" }),
      );
    },
    async addContactToSegment() {},
    async removeContactFromSegment() {},
    ...overrides,
  };
}

describe("contact service", () => {
  it("creates contacts with normalized email, tenant-scoped segment/topic resolution, and webhook payload", async () => {
    let inserted: ContactInsert | null = null;
    const findSegmentByIdOrNameForUser = vi
      .fn<ContactRepository["findSegmentByIdOrNameForUser"]>()
      .mockResolvedValue(segmentRow());
    const findTopicByIdForUser = vi
      .fn<ContactRepository["findTopicByIdForUser"]>()
      .mockResolvedValue(topicRow());
    const service = createContactService({
      repository: createRepository({
        findSegmentByIdOrNameForUser,
        findTopicByIdForUser,
        async create(data) {
          inserted = data;
          return [contactRow({ ...data, id: "created-contact" })];
        },
      }),
    });

    const result = await service.createContact({
      userId: "user-1",
      email: "USER@EXAMPLE.COM",
      firstName: "User",
      lastName: "One",
      properties: { plan: "pro" },
      segments: ["segment-1"],
      topics: [{ id: "topic-1", subscription: "opt_out" }],
    });

    expect(findSegmentByIdOrNameForUser).toHaveBeenCalledWith(
      "segment-1",
      "user-1",
    );
    expect(findTopicByIdForUser).toHaveBeenCalledWith("topic-1", "user-1");
    expect(inserted).toMatchObject({
      email: "user@example.com",
      firstName: "User",
      lastName: "One",
      customProperties: { plan: "pro" },
      segments: ["VIP"],
      topicSubscriptions: [{ topicId: "topic-1", subscribed: false }],
      userId: "user-1",
    });
    expect(result).toMatchObject({
      object: "contact",
      id: "created-contact",
      email: "user@example.com",
      webhookPayload: {
        id: "created-contact",
        email: "user@example.com",
        first_name: "User",
        properties: { plan: "pro" },
        segments: ["VIP"],
        topics: [{ topicId: "topic-1", subscribed: false }],
        created_at: "2026-05-10T00:00:00.000Z",
      },
    });
  });

  it("maps duplicate email persistence failures to a service error", async () => {
    const service = createContactService({
      repository: createRepository({
        async create() {
          throw { code: "23505" };
        },
      }),
    });

    await expect(
      service.createContact({ userId: "user-1", email: "taken@example.com" }),
    ).rejects.toMatchObject({
      code: "duplicate_email",
      message: "A contact with this email already exists",
    } satisfies Partial<ContactServiceError>);
  });

  it("returns an empty list when the requested tenant segment does not exist", async () => {
    const listForApi = vi.fn<ContactRepository["listForApi"]>();
    const service = createContactService({
      repository: createRepository({
        listForApi,
        async findSegmentByIdForUser() {
          return undefined;
        },
      }),
    });

    const result = await service.listContacts({
      userId: "user-1",
      segmentId: "missing-segment",
      limit: 500,
    });

    expect(result).toEqual({ data: [], hasMore: false });
    expect(listForApi).not.toHaveBeenCalled();
  });

  it("normalizes list pagination and preserves public list shape", async () => {
    let options: Parameters<ContactRepository["listForApi"]>[0] | null = null;
    let topicLookup: Parameters<
      ContactRepository["findTopicsByIdsForUser"]
    > | null = null;
    const service = createContactService({
      repository: createRepository({
        async listForApi(input) {
          options = input;
          return {
            data: [
              contactRow({
                unsubscribed: false,
                segments: null,
                topicSubscriptions: [
                  { topicId: "topic-1", subscribed: true },
                  { topicId: "topic-2", subscribed: false },
                ],
              }),
            ],
            hasMore: true,
          };
        },
        async findTopicsByIdsForUser(ids, userId) {
          topicLookup = [ids, userId];
          return [
            topicRow({ id: "topic-1", name: "Product Updates" }),
            topicRow({ id: "topic-2", name: "Changelog" }),
          ];
        },
      }),
    });

    const result = await service.listContacts({
      userId: "user-1",
      search: "user",
      status: "unsubscribed",
      after: "contact-0",
      limit: 500,
    });

    expect(options).toEqual({
      userId: "user-1",
      limit: 100,
      after: "contact-0",
      search: "user",
      status: "unsubscribed",
      segmentName: undefined,
    });
    expect(topicLookup).toEqual([["topic-1", "topic-2"], "user-1"]);
    expect(result).toEqual({
      data: [
        {
          id: "contact-1",
          email: "user@example.com",
          firstName: "User",
          lastName: "One",
          first_name: "User",
          last_name: "One",
          unsubscribed: false,
          status: "subscribed",
          segments: [],
          topics: [
            {
              id: "topic-1",
              name: "Product Updates",
              subscription: "opt_in",
            },
            {
              id: "topic-2",
              name: "Changelog",
              subscription: "opt_out",
            },
          ],
          created_at: createdAt,
        },
      ],
      hasMore: true,
    });
  });

  it("updates only changed fields and skips persistence for no-op patches", async () => {
    const updateForUser = vi
      .fn<ContactRepository["updateForUser"]>()
      .mockResolvedValue([contactRow({ firstName: "After" })]);
    const service = createContactService({
      repository: createRepository({ updateForUser }),
    });

    const updated = await service.updateContact({
      userId: "user-1",
      idOrEmail: "contact-1",
      changes: { first_name: "After" },
    });

    expect(updateForUser).toHaveBeenCalledWith("contact-1", "user-1", {
      firstName: "After",
    });
    expect(updated.changedFields).toEqual(["first_name"]);
    expect(updated.webhookPayload.first_name).toBe("After");

    updateForUser.mockClear();
    const unchanged = await service.updateContact({
      userId: "user-1",
      idOrEmail: "contact-1",
      changes: { first_name: "User" },
    });

    expect(updateForUser).not.toHaveBeenCalled();
    expect(unchanged.changedFields).toEqual([]);
  });

  it("adds and removes contact segment associations with legacy segment array sync", async () => {
    const addContactToSegment =
      vi.fn<ContactRepository["addContactToSegment"]>();
    const removeContactFromSegment =
      vi.fn<ContactRepository["removeContactFromSegment"]>();
    const updateForUser = vi
      .fn<ContactRepository["updateForUser"]>()
      .mockResolvedValue([contactRow()]);
    const service = createContactService({
      repository: createRepository({
        addContactToSegment,
        removeContactFromSegment,
        updateForUser,
        async findByIdOrEmailForUser() {
          return contactRow({ segments: ["Newsletter"] });
        },
        async findSegmentByIdForUser() {
          return segmentRow({ id: "segment-1", name: "VIP" });
        },
      }),
    });

    await expect(
      service.addContactToSegment({
        userId: "user-1",
        idOrEmail: "contact-1",
        segmentId: "segment-1",
      }),
    ).resolves.toEqual({ contactId: "contact-1", segmentId: "segment-1" });
    expect(addContactToSegment).toHaveBeenCalledWith("contact-1", "segment-1");
    expect(updateForUser).toHaveBeenCalledWith("contact-1", "user-1", {
      segments: ["Newsletter", "VIP"],
    });

    updateForUser.mockClear();
    await expect(
      service.removeContactFromSegment({
        userId: "user-1",
        idOrEmail: "contact-1",
        segmentId: "segment-1",
      }),
    ).resolves.toEqual({ contactId: "contact-1", segmentId: "segment-1" });
    expect(removeContactFromSegment).toHaveBeenCalledWith(
      "contact-1",
      "segment-1",
    );
    expect(updateForUser).not.toHaveBeenCalled();
  });
});
