import { describe, expect, it, vi } from "vitest";
import {
  type ContactOperationsRepository,
  type ContactOperationsServiceError,
  createContactOperationsService,
} from "../packages/core/src/services/contact-operations";

type ContactRow = NonNullable<
  Awaited<
    ReturnType<ContactOperationsRepository["findContactByIdOrEmailForUser"]>
  >
>;
type SegmentRow = NonNullable<
  Awaited<ReturnType<ContactOperationsRepository["findSegmentByIdForUser"]>>
>;
type TopicRow = NonNullable<
  Awaited<ReturnType<ContactOperationsRepository["findTopicByIdForUser"]>>
>;
type ContactInsert = Parameters<
  ContactOperationsRepository["createContact"]
>[0];

const createdAt = new Date("2026-05-11T00:00:00.000Z");

function contactRow(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: "contact-1",
    email: "user@example.com",
    firstName: "User",
    lastName: "One",
    unsubscribed: false,
    customProperties: { plan: "pro" },
    segments: [],
    topicSubscriptions: [],
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
    name: "News",
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
  overrides: Partial<ContactOperationsRepository> = {},
): ContactOperationsRepository {
  return {
    async findContactByIdOrEmailForUser() {
      return contactRow();
    },
    async findContactByEmailForUser() {
      return undefined;
    },
    async findContactsByIdsForUser() {
      return [contactRow()];
    },
    async createContact(data: ContactInsert) {
      return [{ id: data.email === "new@example.com" ? "contact-new" : "c" }];
    },
    async updateContactForUser() {},
    async findSegmentByIdForUser() {
      return segmentRow();
    },
    async findTopicByIdForUser(topicId: string) {
      return topicRow({ id: topicId });
    },
    ...overrides,
  };
}

describe("contact operations service", () => {
  it("bulk-adds a segment only to caller-scoped contacts missing that segment", async () => {
    const findContactsByIdsForUser = vi
      .fn<ContactOperationsRepository["findContactsByIdsForUser"]>()
      .mockResolvedValue([
        contactRow({ id: "contact-1", segments: [] }),
        contactRow({ id: "contact-2", segments: ["VIP"] }),
      ]);
    const updateContactForUser = vi
      .fn<ContactOperationsRepository["updateContactForUser"]>()
      .mockResolvedValue(undefined);
    const service = createContactOperationsService({
      repository: createRepository({
        findContactsByIdsForUser,
        updateContactForUser,
      }),
    });

    const result = await service.bulkAction({
      userId: "user-1",
      body: {
        action: "add_to_segment",
        segment_id: "segment-1",
        contact_ids: ["contact-1", "contact-2", "outside-tenant"],
      },
    });

    expect(findContactsByIdsForUser).toHaveBeenCalledWith(
      ["contact-1", "contact-2", "outside-tenant"],
      "user-1",
    );
    expect(updateContactForUser).toHaveBeenCalledTimes(1);
    expect(updateContactForUser).toHaveBeenCalledWith("contact-1", "user-1", {
      segments: ["VIP"],
    });
    expect(result).toEqual({
      object: "bulk_action",
      success: true,
      count: 2,
    });
  });

  it("bulk-subscribes caller-scoped contacts to a topic and preserves legacy validation statuses", async () => {
    const updateContactForUser = vi
      .fn<ContactOperationsRepository["updateContactForUser"]>()
      .mockResolvedValue(undefined);
    const service = createContactOperationsService({
      repository: createRepository({
        async findContactsByIdsForUser() {
          return [
            contactRow({
              id: "contact-1",
              topicSubscriptions: [{ topicId: "topic-1", subscribed: false }],
            }),
            contactRow({ id: "contact-2", topicSubscriptions: null }),
          ];
        },
        updateContactForUser,
      }),
    });

    await expect(
      service.bulkAction({ userId: "user-1", body: { action: "whatever" } }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "contact_ids must be a non-empty array",
      status: 422,
    } satisfies Partial<ContactOperationsServiceError>);

    await expect(
      service.bulkAction({
        userId: "user-1",
        body: { action: "whatever", contact_ids: ["contact-1"] },
      }),
    ).rejects.toMatchObject({
      code: "invalid_input",
      message: "Invalid action",
      status: 400,
    } satisfies Partial<ContactOperationsServiceError>);

    const result = await service.bulkAction({
      userId: "user-1",
      body: {
        action: "subscribe_to_topic",
        topic_id: "topic-1",
        contact_ids: ["contact-1", "contact-2"],
      },
    });

    expect(updateContactForUser).toHaveBeenCalledWith("contact-1", "user-1", {
      topicSubscriptions: [{ topicId: "topic-1", subscribed: true }],
    });
    expect(updateContactForUser).toHaveBeenCalledWith("contact-2", "user-1", {
      topicSubscriptions: [{ topicId: "topic-1", subscribed: true }],
    });
    expect(result).toEqual({
      object: "bulk_action",
      success: true,
      count: 2,
    });
  });

  it("imports rows with lowercased email mapping, optional segment, upsert, and custom property merge", async () => {
    const createdContacts: ContactInsert[] = [];
    const updates: Array<
      Parameters<ContactOperationsRepository["updateContactForUser"]>
    > = [];
    const service = createContactOperationsService({
      repository: createRepository({
        async findContactByEmailForUser(email) {
          if (email === "existing@example.com") {
            return contactRow({
              id: "contact-existing",
              email,
              firstName: "Existing",
              lastName: "Person",
              segments: ["Old"],
              customProperties: { plan: "free" },
            });
          }
          return undefined;
        },
        async createContact(data) {
          createdContacts.push(data);
          return [{ id: "contact-new" }];
        },
        async updateContactForUser(...args) {
          updates.push(args);
        },
      }),
    });

    const result = await service.importContacts({
      userId: "user-1",
      segmentId: "segment-1",
      mapping: {
        Email: "email",
        First: "first_name",
        Last: "last_name",
        Plan: "plan",
      },
      rows: [
        {
          Email: " Existing@Example.com ",
          First: "",
          Last: "Updated",
          Plan: "enterprise",
        },
        { Email: "NEW@Example.com", First: "New", Last: "User", Plan: "pro" },
        { Email: "", First: "Skipped" },
      ],
    });

    expect(updates).toEqual([
      [
        "contact-existing",
        "user-1",
        {
          firstName: "Existing",
          lastName: "Updated",
          segments: ["Old", "VIP"],
          customProperties: { plan: "enterprise" },
        },
      ],
    ]);
    expect(createdContacts).toEqual([
      {
        email: "new@example.com",
        firstName: "New",
        lastName: "User",
        segments: ["VIP"],
        customProperties: { plan: "pro" },
        userId: "user-1",
      },
    ]);
    expect(result).toEqual({
      object: "import",
      created_count: 2,
      ids: ["contact-existing", "contact-new"],
    });
  });

  it("lists contact topics with opt-in/out mapping and filters topics outside the caller tenant", async () => {
    const service = createContactOperationsService({
      repository: createRepository({
        async findContactByIdOrEmailForUser(idOrEmail, userId) {
          expect(idOrEmail).toBe("user@example.com");
          expect(userId).toBe("user-1");
          return contactRow({
            topicSubscriptions: [
              { topicId: "topic-1", subscribed: true },
              { topicId: "topic-missing", subscribed: false },
            ],
          });
        },
        async findTopicByIdForUser(topicId) {
          if (topicId === "topic-missing") return undefined;
          return topicRow({ id: topicId, name: "News" });
        },
      }),
    });

    await expect(
      service.listContactTopics({
        userId: "user-1",
        idOrEmail: "user@example.com",
      }),
    ).resolves.toEqual({
      object: "list",
      data: [{ id: "topic-1", name: "News", subscription: "opt_in" }],
    });
  });

  it("replaces topic subscriptions after contact lookup and maps non-opt-in values to opt-out", async () => {
    const updateContactForUser = vi
      .fn<ContactOperationsRepository["updateContactForUser"]>()
      .mockResolvedValue(undefined);
    const readBody = vi.fn().mockResolvedValue({
      topics: [
        { id: "topic-1", subscription: "opt_in" },
        { id: "topic-2", subscription: "opt_out" },
        { id: "topic-3", subscription: "unexpected" },
      ],
    });
    const service = createContactOperationsService({
      repository: createRepository({ updateContactForUser }),
    });

    const result = await service.updateContactTopics({
      userId: "user-1",
      idOrEmail: "contact-1",
      body: readBody,
    });

    expect(readBody).toHaveBeenCalledOnce();
    expect(updateContactForUser).toHaveBeenCalledWith("contact-1", "user-1", {
      topicSubscriptions: [
        { topicId: "topic-1", subscribed: true },
        { topicId: "topic-2", subscribed: false },
        { topicId: "topic-3", subscribed: false },
      ],
    });
    expect(result).toEqual({
      object: "contact_topics",
      contact_id: "contact-1",
      updated: true,
    });
  });

  it("rejects topic updates for missing or cross-tenant topics", async () => {
    const updateContactForUser = vi
      .fn<ContactOperationsRepository["updateContactForUser"]>()
      .mockResolvedValue(undefined);
    const service = createContactOperationsService({
      repository: createRepository({
        updateContactForUser,
        async findTopicByIdForUser(topicId) {
          return topicId === "topic-owned"
            ? topicRow({ id: topicId })
            : undefined;
        },
      }),
    });

    await expect(
      service.updateContactTopics({
        userId: "user-1",
        idOrEmail: "contact-1",
        body: {
          topics: [
            { id: "topic-owned", subscription: "opt_in" },
            { id: "topic-other", subscription: "opt_in" },
          ],
        },
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Topic not found",
      status: 404,
    } satisfies Partial<ContactOperationsServiceError>);
    expect(updateContactForUser).not.toHaveBeenCalled();
  });

  it("does not parse update topics body when the contact is not found", async () => {
    const readBody = vi.fn().mockResolvedValue({ topics: [] });
    const service = createContactOperationsService({
      repository: createRepository({
        async findContactByIdOrEmailForUser() {
          return undefined;
        },
      }),
    });

    await expect(
      service.updateContactTopics({
        userId: "user-1",
        idOrEmail: "missing@example.com",
        body: readBody,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
      message: "Contact not found",
      status: 404,
    } satisfies Partial<ContactOperationsServiceError>);
    expect(readBody).not.toHaveBeenCalled();
  });
});
