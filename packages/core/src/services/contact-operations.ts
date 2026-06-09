import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "../db/client";
import { contacts, segments, topics } from "../db/schema";

type ContactRow = typeof contacts.$inferSelect;
type ContactInsert = typeof contacts.$inferInsert;
type SegmentRow = typeof segments.$inferSelect;
type TopicRow = typeof topics.$inferSelect;

type ContactTopicSubscription = { topicId: string; subscribed: boolean };
type PublicContactTopicSubscription = "opt_in" | "opt_out";

type ImportCsvRow = Record<string, string | undefined>;
type ImportMapping = Record<string, string>;

type ImportMappedContact = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

export type ContactBulkActionInput = {
  userId: string;
  body: unknown;
};

export type ImportContactsInput = {
  userId: string;
  rows: ImportCsvRow[];
  mapping: ImportMapping;
  segmentId?: string | null;
};

export type ListContactTopicsInput = {
  userId: string;
  idOrEmail: string;
};

export type UpdateContactTopicsInput = {
  userId: string;
  idOrEmail: string;
  body: unknown | (() => Promise<unknown>);
};

export type ContactBulkActionResult = {
  object: "bulk_action";
  success: true;
  count: number;
};

export type ImportContactsResult = {
  object: "import";
  created_count: number;
  ids: string[];
};

export type ContactTopicListItem = {
  id: string;
  name: string;
  subscription: PublicContactTopicSubscription;
};

export type ContactTopicsListResult = {
  object: "list";
  data: ContactTopicListItem[];
};

export type ContactTopicsUpdateResult = {
  object: "contact_topics";
  contact_id: string;
  updated: true;
};

export type ContactOperationsServiceErrorCode = "invalid_input" | "not_found";

export class ContactOperationsServiceError extends Error {
  constructor(
    readonly code: ContactOperationsServiceErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ContactOperationsServiceError";
  }
}

export type ContactOperationsRepository = {
  findContactByIdOrEmailForUser(
    idOrEmail: string,
    userId: string,
  ): Promise<ContactRow | undefined>;
  findContactByEmailForUser(
    email: string,
    userId: string,
  ): Promise<ContactRow | undefined>;
  findContactsByIdsForUser(
    contactIds: unknown[],
    userId: string,
  ): Promise<ContactRow[]>;
  createContact(data: ContactInsert): Promise<Array<{ id: string }>>;
  updateContactForUser(
    id: string,
    userId: string,
    data: Partial<ContactInsert>,
  ): Promise<unknown>;
  findSegmentByIdForUser(
    segmentId: string,
    userId: string,
  ): Promise<SegmentRow | undefined>;
  findTopicByIdForUser(
    topicId: string,
    userId: string,
  ): Promise<TopicRow | undefined>;
};

export type ContactOperationsServiceDependencies = {
  repository?: ContactOperationsRepository;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSegments(value: ContactRow["segments"]): string[] {
  return Array.isArray(value) ? value : [];
}

function normalizeTopicSubscriptions(
  value: ContactRow["topicSubscriptions"],
): ContactTopicSubscription[] {
  return Array.isArray(value) ? value : [];
}

function normalizeCustomProperties(
  value: ContactRow["customProperties"],
): Record<string, string> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function mapInternalToPublicSubscription(
  subscribed: boolean,
): PublicContactTopicSubscription {
  return subscribed ? "opt_in" : "opt_out";
}

function mapPublicToInternalSubscription(subscription: unknown): boolean {
  return subscription === "opt_in";
}

function invalidInput(message: string, status = 422) {
  return new ContactOperationsServiceError("invalid_input", message, status);
}

function notFound(message: string) {
  return new ContactOperationsServiceError("not_found", message, 404);
}

function defaultRepository(): ContactOperationsRepository {
  return {
    async findContactByIdOrEmailForUser(idOrEmail, userId) {
      return await db.query.contacts.findFirst({
        where: and(
          isUuid(idOrEmail)
            ? or(eq(contacts.id, idOrEmail), eq(contacts.email, idOrEmail))
            : eq(contacts.email, idOrEmail),
          eq(contacts.userId, userId),
        ),
      });
    },
    async findContactByEmailForUser(email, userId) {
      return await db.query.contacts.findFirst({
        where: and(eq(contacts.email, email), eq(contacts.userId, userId)),
      });
    },
    async findContactsByIdsForUser(contactIds, userId) {
      return await db.query.contacts.findMany({
        where: and(
          inArray(contacts.id, contactIds as string[]),
          eq(contacts.userId, userId),
        ),
      });
    },
    async createContact(data) {
      return await db
        .insert(contacts)
        .values(data)
        .returning({ id: contacts.id });
    },
    async updateContactForUser(id, userId, data) {
      return await db
        .update(contacts)
        .set(data)
        .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
    },
    async findSegmentByIdForUser(segmentId, userId) {
      return await db.query.segments.findFirst({
        where: and(eq(segments.id, segmentId), eq(segments.userId, userId)),
      });
    },
    async findTopicByIdForUser(topicId, userId) {
      return await db.query.topics.findFirst({
        where: and(eq(topics.id, topicId), eq(topics.userId, userId)),
      });
    },
  };
}

function parseBulkBody(body: unknown): {
  contactIds: unknown[];
  segmentId?: string;
  topicId?: string;
  action?: unknown;
} {
  const payload = isRecord(body) ? body : {};
  const contactIds = payload.contact_ids;

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw invalidInput("contact_ids must be a non-empty array");
  }

  return {
    contactIds,
    segmentId:
      typeof payload.segment_id === "string" ? payload.segment_id : undefined,
    topicId:
      typeof payload.topic_id === "string" ? payload.topic_id : undefined,
    action: payload.action,
  };
}

function mapImportRow(
  row: ImportCsvRow,
  mapping: ImportMapping,
): { data: ImportMappedContact; customProps: Record<string, string> } {
  const data: ImportMappedContact = {};
  const customProps: Record<string, string> = {};

  for (const [colName, colValue] of Object.entries(row)) {
    const mappedKey = mapping[colName];
    if (!mappedKey) continue;

    const value = colValue?.trim();
    if (mappedKey === "email") data.email = value?.toLowerCase();
    else if (mappedKey === "first_name") data.firstName = value;
    else if (mappedKey === "last_name") data.lastName = value;
    else if (value !== undefined) customProps[mappedKey] = value;
  }

  return { data, customProps };
}

async function resolveRequestBody(
  body: unknown | (() => Promise<unknown>),
): Promise<unknown> {
  return typeof body === "function" ? await body() : body;
}

function parseTopicsBody(body: unknown): Array<{
  id: unknown;
  subscription: unknown;
}> {
  const payload = isRecord(body) ? body : {};
  const newTopics = payload.topics;

  if (!Array.isArray(newTopics)) {
    throw invalidInput("topics must be an array");
  }

  return newTopics.map((topic) => {
    const record = isRecord(topic) ? topic : {};
    return {
      id: record.id,
      subscription: record.subscription,
    };
  });
}

export function createContactOperationsService({
  repository = defaultRepository(),
}: ContactOperationsServiceDependencies = {}) {
  return {
    async bulkAction(
      input: ContactBulkActionInput,
    ): Promise<ContactBulkActionResult> {
      const { contactIds, segmentId, topicId, action } = parseBulkBody(
        input.body,
      );

      if (action === "add_to_segment") {
        if (!segmentId) throw invalidInput("segment_id is required");

        const segment = await repository.findSegmentByIdForUser(
          segmentId,
          input.userId,
        );
        if (!segment) throw notFound("Segment not found");

        const targetContacts = await repository.findContactsByIdsForUser(
          contactIds,
          input.userId,
        );

        await Promise.all(
          targetContacts.map(async (contact) => {
            const currentSegments = normalizeSegments(contact.segments);
            if (!currentSegments.includes(segment.name)) {
              await repository.updateContactForUser(contact.id, input.userId, {
                segments: [...currentSegments, segment.name],
              });
            }
          }),
        );

        return {
          object: "bulk_action",
          success: true,
          count: targetContacts.length,
        };
      }

      if (action === "subscribe_to_topic") {
        if (!topicId) throw invalidInput("topic_id is required");

        const topic = await repository.findTopicByIdForUser(
          topicId,
          input.userId,
        );
        if (!topic) throw notFound("Topic not found");

        const targetContacts = await repository.findContactsByIdsForUser(
          contactIds,
          input.userId,
        );

        await Promise.all(
          targetContacts.map(async (contact) => {
            const currentTopics = normalizeTopicSubscriptions(
              contact.topicSubscriptions,
            );
            const exists = currentTopics.some(
              (subscription) => subscription.topicId === topic.id,
            );
            const updatedSubscriptions = exists
              ? currentTopics.map((subscription) =>
                  subscription.topicId === topic.id
                    ? { ...subscription, subscribed: true }
                    : subscription,
                )
              : [...currentTopics, { topicId: topic.id, subscribed: true }];

            await repository.updateContactForUser(contact.id, input.userId, {
              topicSubscriptions: updatedSubscriptions,
            });
          }),
        );

        return {
          object: "bulk_action",
          success: true,
          count: targetContacts.length,
        };
      }

      throw invalidInput("Invalid action", 400);
    },

    async importContacts(
      input: ImportContactsInput,
    ): Promise<ImportContactsResult> {
      let segmentName = "";
      if (input.segmentId) {
        const segment = await repository.findSegmentByIdForUser(
          input.segmentId,
          input.userId,
        );
        if (segment) segmentName = segment.name;
      }

      const createdIds: string[] = [];

      for (const row of input.rows) {
        const { data, customProps } = mapImportRow(row, input.mapping);
        if (!data.email) continue;

        const existing = await repository.findContactByEmailForUser(
          data.email,
          input.userId,
        );

        if (existing) {
          const currentSegments = normalizeSegments(existing.segments);
          const updatedSegments =
            segmentName && !currentSegments.includes(segmentName)
              ? [...currentSegments, segmentName]
              : currentSegments;

          await repository.updateContactForUser(existing.id, input.userId, {
            firstName: data.firstName || existing.firstName,
            lastName: data.lastName || existing.lastName,
            segments: updatedSegments,
            customProperties: {
              ...normalizeCustomProperties(existing.customProperties),
              ...customProps,
            },
          });
          createdIds.push(existing.id);
        } else {
          const [inserted] = await repository.createContact({
            email: data.email,
            firstName: data.firstName || null,
            lastName: data.lastName || null,
            segments: segmentName ? [segmentName] : null,
            customProperties: customProps,
            userId: input.userId,
          });
          createdIds.push(inserted.id);
        }
      }

      return {
        object: "import",
        created_count: createdIds.length,
        ids: createdIds,
      };
    },

    async listContactTopics(
      input: ListContactTopicsInput,
    ): Promise<ContactTopicsListResult> {
      const contact = await repository.findContactByIdOrEmailForUser(
        input.idOrEmail,
        input.userId,
      );
      if (!contact) throw notFound("Contact not found");

      const subscriptions = normalizeTopicSubscriptions(
        contact.topicSubscriptions,
      );
      const data = await Promise.all(
        subscriptions.map(async (subscription) => {
          const topic = await repository.findTopicByIdForUser(
            subscription.topicId,
            input.userId,
          );
          if (!topic) return null;
          return {
            id: topic.id,
            name: topic.name,
            subscription: mapInternalToPublicSubscription(
              subscription.subscribed,
            ),
          };
        }),
      ).then((results) => results.filter((row) => row !== null));

      return {
        object: "list",
        data,
      };
    },

    async updateContactTopics(
      input: UpdateContactTopicsInput,
    ): Promise<ContactTopicsUpdateResult> {
      const contact = await repository.findContactByIdOrEmailForUser(
        input.idOrEmail,
        input.userId,
      );
      if (!contact) throw notFound("Contact not found");

      const body = await resolveRequestBody(input.body);
      const newTopics = parseTopicsBody(body);
      const updatedSubscriptions = await Promise.all(
        newTopics.map(async (topic) => {
          if (typeof topic.id !== "string") {
            throw invalidInput("topic id is required");
          }

          const foundTopic = await repository.findTopicByIdForUser(
            topic.id,
            input.userId,
          );
          if (!foundTopic) throw notFound("Topic not found");

          return {
            topicId: foundTopic.id,
            subscribed: mapPublicToInternalSubscription(topic.subscription),
          };
        }),
      );

      await repository.updateContactForUser(contact.id, input.userId, {
        topicSubscriptions: updatedSubscriptions,
      });

      return {
        object: "contact_topics",
        contact_id: contact.id,
        updated: true,
      };
    },
  };
}

export const contactOperationsService = createContactOperationsService();
