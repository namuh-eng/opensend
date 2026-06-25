import { contactRepo } from "../db/repositories/contactRepo";
import type { contacts, segments, topics } from "../db/schema";

type ContactRow = typeof contacts.$inferSelect;
type ContactInsert = typeof contacts.$inferInsert;
type SegmentRow = typeof segments.$inferSelect;
type TopicRow = typeof topics.$inferSelect;

type ContactTopicSubscription = { topicId: string; subscribed: boolean };

type PublicContactTopic = { id: string; subscription: "opt_in" | "opt_out" };

type ContactServiceListTopic = PublicContactTopic & { name: string };

export type CreateContactTopicInput =
  | string
  | { id: string; subscription?: "opt_in" | "opt_out" };

export type CreateContactInput = {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  unsubscribed?: boolean;
  properties?: Record<string, string>;
  segments?: string[];
  topics?: CreateContactTopicInput[];
};

export type UpdateContactInput = {
  userId: string;
  idOrEmail: string;
  changes: Record<string, unknown>;
};

export type ListContactsInput = {
  userId: string;
  search?: string;
  limit?: number;
  status?: string;
  segmentId?: string;
  after?: string;
};

export type ContactWebhookPayload = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  properties: Record<string, string>;
  segments: string[];
  topics: ContactTopicSubscription[];
  created_at: string | Date | null;
};

export type ContactServiceListItem = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  status: "subscribed" | "unsubscribed";
  segments: string[];
  topics: ContactServiceListTopic[];
  created_at: ContactRow["createdAt"];
};

export type ContactDetail = {
  object: "contact";
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  properties: Record<string, string> | null;
  segments: string[];
  topics: PublicContactTopic[];
  created_at: ContactRow["createdAt"];
};

export type ContactMutationResult = ContactDetail & {
  webhookPayload: ContactWebhookPayload;
};

export type ContactUpdateResult = ContactDetail & {
  changedFields: string[];
  webhookPayload: ContactWebhookPayload;
};

export type DeleteContactResult = {
  id: string;
  email: string;
};

export type ContactSegmentListItem = {
  id: string;
  name: string;
  created_at: SegmentRow["createdAt"];
};

export type ContactSegmentMutationResult = {
  contactId: string;
  segmentId: string;
};

export type ContactListResult = {
  data: ContactServiceListItem[];
  hasMore: boolean;
};

export type ContactServiceErrorCode = "duplicate_email" | "not_found";

export class ContactServiceError extends Error {
  constructor(
    readonly code: ContactServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContactServiceError";
  }
}

export type ContactRepository = {
  findByIdOrEmailForUser(
    idOrEmail: string,
    userId: string,
  ): Promise<ContactRow | undefined>;
  create(data: ContactInsert): Promise<ContactRow[]>;
  updateForUser(
    id: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<ContactRow[]>;
  deleteForUser(
    id: string,
    userId: string,
  ): Promise<Array<{ id: string; email: string }>>;
  listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    search?: string;
    status?: string;
    segmentName?: string;
  }): Promise<{
    data: Pick<
      ContactRow,
      | "id"
      | "email"
      | "firstName"
      | "lastName"
      | "unsubscribed"
      | "segments"
      | "topicSubscriptions"
      | "createdAt"
    >[];
    hasMore: boolean;
  }>;
  findSegmentByIdForUser(
    segmentId: string,
    userId: string,
  ): Promise<SegmentRow | undefined>;
  findSegmentByIdOrNameForUser(
    idOrName: string,
    userId: string,
  ): Promise<SegmentRow | undefined>;
  findSegmentsByNamesForUser(
    names: string[],
    userId: string,
  ): Promise<Pick<SegmentRow, "id" | "name" | "createdAt">[]>;
  findTopicByIdForUser(
    topicId: string,
    userId: string,
  ): Promise<TopicRow | undefined>;
  findTopicsByIdsForUser(
    topicIds: string[],
    userId: string,
  ): Promise<Pick<TopicRow, "id" | "name">[]>;
  addContactToSegment(contactId: string, segmentId: string): Promise<void>;
  removeContactFromSegment(contactId: string, segmentId: string): Promise<void>;
};

export type ContactServiceDependencies = {
  repository?: ContactRepository;
};

function normalizeLimit(limit: number | undefined): number {
  return Math.min(100, Math.max(1, limit || 40));
}

function normalizeEmail(email: string): string {
  return email.toLowerCase();
}

function normalizeSegments(value: ContactRow["segments"]): string[] {
  return Array.isArray(value) ? value : [];
}

function normalizeTopics(
  value: ContactRow["topicSubscriptions"],
): ContactTopicSubscription[] {
  return Array.isArray(value) ? value : [];
}

function normalizeProperties(
  value: ContactRow["customProperties"],
): Record<string, string> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function toCreatedAtPayload(
  value: ContactRow["createdAt"],
): string | Date | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function toWebhookPayload(contact: ContactRow): ContactWebhookPayload {
  return {
    id: contact.id,
    email: contact.email,
    first_name: contact.firstName,
    last_name: contact.lastName,
    unsubscribed: contact.unsubscribed,
    properties: normalizeProperties(contact.customProperties) ?? {},
    segments: normalizeSegments(contact.segments),
    topics: normalizeTopics(contact.topicSubscriptions),
    created_at: toCreatedAtPayload(contact.createdAt),
  };
}

function toPublicTopics(contact: ContactRow): PublicContactTopic[] {
  return normalizeTopics(contact.topicSubscriptions).map((topic) => ({
    id: topic.topicId,
    subscription: topic.subscribed ? "opt_in" : "opt_out",
  }));
}

function toContactDetail(contact: ContactRow): ContactDetail {
  return {
    object: "contact",
    id: contact.id,
    email: contact.email,
    first_name: contact.firstName,
    last_name: contact.lastName,
    unsubscribed: contact.unsubscribed,
    properties: normalizeProperties(contact.customProperties),
    segments: normalizeSegments(contact.segments),
    topics: toPublicTopics(contact),
    created_at: contact.createdAt,
  };
}

function toContactServiceListItem(
  contact: Pick<
    ContactRow,
    | "id"
    | "email"
    | "firstName"
    | "lastName"
    | "unsubscribed"
    | "segments"
    | "topicSubscriptions"
    | "createdAt"
  >,
  topicsById: ReadonlyMap<string, string>,
): ContactServiceListItem {
  return {
    id: contact.id,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    first_name: contact.firstName,
    last_name: contact.lastName,
    unsubscribed: contact.unsubscribed,
    status: contact.unsubscribed ? "unsubscribed" : "subscribed",
    segments: normalizeSegments(contact.segments),
    topics: normalizeTopics(contact.topicSubscriptions)
      .map((topic) => {
        const name = topicsById.get(topic.topicId);
        if (!name) return null;
        return {
          id: topic.topicId,
          name,
          subscription: topic.subscribed ? "opt_in" : "opt_out",
        };
      })
      .filter((topic): topic is ContactServiceListTopic => topic !== null),
    created_at: contact.createdAt,
  };
}

async function resolveListTopicNames(
  repository: ContactRepository,
  userId: string,
  contacts: readonly Pick<ContactRow, "topicSubscriptions">[],
): Promise<ReadonlyMap<string, string>> {
  const topicIds = [
    ...new Set(
      contacts.flatMap((contact) =>
        normalizeTopics(contact.topicSubscriptions).map(
          (topic) => topic.topicId,
        ),
      ),
    ),
  ];
  if (topicIds.length === 0) return new Map();

  const topicRows = await repository.findTopicsByIdsForUser(topicIds, userId);
  return new Map(topicRows.map((topic) => [topic.id, topic.name]));
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

async function resolveSegmentNames(
  repository: ContactRepository,
  userId: string,
  requestedSegments: string[] | undefined,
): Promise<string[]> {
  if (!requestedSegments) return [];

  const segments = await Promise.all(
    requestedSegments.map((segment) =>
      repository.findSegmentByIdOrNameForUser(segment, userId),
    ),
  );

  return segments
    .map((segment) => segment?.name ?? null)
    .filter((name): name is string => name !== null);
}

async function resolveTopicSubscriptions(
  repository: ContactRepository,
  userId: string,
  requestedTopics: CreateContactTopicInput[] | undefined,
): Promise<ContactTopicSubscription[]> {
  if (!requestedTopics) return [];

  const topics = await Promise.all(
    requestedTopics.map(async (topic) => {
      const topicId = typeof topic === "string" ? topic : topic.id;
      const subscription =
        typeof topic === "string" ? "opt_in" : topic.subscription || "opt_in";
      const found = await repository.findTopicByIdForUser(topicId, userId);
      if (!found) return null;
      return {
        topicId: found.id,
        subscribed: subscription === "opt_in",
      };
    }),
  );

  return topics.filter(
    (topic): topic is ContactTopicSubscription => topic !== null,
  );
}

function toUpdateData(
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {};
  if (changes.email !== undefined) updateData.email = changes.email;
  if (changes.first_name !== undefined)
    updateData.firstName = changes.first_name;
  if (changes.last_name !== undefined) updateData.lastName = changes.last_name;
  if (changes.unsubscribed !== undefined) {
    updateData.unsubscribed = changes.unsubscribed;
  }
  if (changes.properties !== undefined) {
    updateData.customProperties = changes.properties;
  }
  return updateData;
}

function getCurrentFieldValue(contact: ContactRow, field: string): unknown {
  if (field === "first_name") return contact.firstName;
  if (field === "last_name") return contact.lastName;
  if (field === "properties") return contact.customProperties;
  if (field === "unsubscribed") return contact.unsubscribed;
  return contact.email;
}

function getChangedFields(
  contact: ContactRow,
  updateData: Record<string, unknown>,
): string[] {
  return Object.entries({
    email: updateData.email,
    first_name: updateData.firstName,
    last_name: updateData.lastName,
    unsubscribed: updateData.unsubscribed,
    properties: updateData.customProperties,
  })
    .filter(([, value]) => value !== undefined)
    .filter(
      ([field, value]) =>
        !valuesEqual(getCurrentFieldValue(contact, field), value),
    )
    .map(([field]) => field);
}

export function createContactService({
  repository = contactRepo,
}: ContactServiceDependencies = {}) {
  return {
    async createContact(
      input: CreateContactInput,
    ): Promise<ContactMutationResult> {
      const resolvedSegments = await resolveSegmentNames(
        repository,
        input.userId,
        input.segments,
      );
      const resolvedTopics = await resolveTopicSubscriptions(
        repository,
        input.userId,
        input.topics,
      );

      try {
        const [inserted] = await repository.create({
          email: normalizeEmail(input.email),
          firstName: input.firstName || null,
          lastName: input.lastName || null,
          unsubscribed: input.unsubscribed ?? false,
          customProperties: input.properties || null,
          segments: resolvedSegments.length > 0 ? resolvedSegments : null,
          topicSubscriptions: resolvedTopics.length > 0 ? resolvedTopics : null,
          userId: input.userId,
        });

        return {
          ...toContactDetail(inserted),
          webhookPayload: toWebhookPayload(inserted),
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ContactServiceError(
            "duplicate_email",
            "A contact with this email already exists",
          );
        }
        throw error;
      }
    },

    async listContacts(input: ListContactsInput): Promise<ContactListResult> {
      let segmentName: string | undefined;
      if (input.segmentId) {
        const segment = await repository.findSegmentByIdForUser(
          input.segmentId,
          input.userId,
        );
        if (!segment) return { data: [], hasMore: false };
        segmentName = segment.name;
      }

      const result = await repository.listForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        after: input.after || undefined,
        search: input.search || undefined,
        status: input.status || undefined,
        segmentName,
      });
      const topicsById = await resolveListTopicNames(
        repository,
        input.userId,
        result.data,
      );

      return {
        data: result.data.map((contact) =>
          toContactServiceListItem(contact, topicsById),
        ),
        hasMore: result.hasMore,
      };
    },

    async getContact(
      idOrEmail: string,
      userId: string,
    ): Promise<ContactDetail> {
      const contact = await repository.findByIdOrEmailForUser(
        idOrEmail,
        userId,
      );
      if (!contact) {
        throw new ContactServiceError("not_found", "Contact not found");
      }
      return toContactDetail(contact);
    },

    async updateContact(
      input: UpdateContactInput,
    ): Promise<ContactUpdateResult> {
      const contact = await repository.findByIdOrEmailForUser(
        input.idOrEmail,
        input.userId,
      );
      if (!contact) {
        throw new ContactServiceError("not_found", "Contact not found");
      }

      const updateData = toUpdateData(input.changes);
      const changedFields = getChangedFields(contact, updateData);

      if (changedFields.length === 0) {
        return {
          ...toContactDetail(contact),
          changedFields,
          webhookPayload: toWebhookPayload(contact),
        };
      }

      const [updated] = await repository.updateForUser(
        contact.id,
        input.userId,
        updateData,
      );

      if (!updated) {
        throw new ContactServiceError("not_found", "Contact not found");
      }

      return {
        ...toContactDetail(updated),
        changedFields,
        webhookPayload: toWebhookPayload(updated),
      };
    },

    async deleteContact(
      idOrEmail: string,
      userId: string,
    ): Promise<DeleteContactResult> {
      const contact = await repository.findByIdOrEmailForUser(
        idOrEmail,
        userId,
      );
      if (!contact) {
        throw new ContactServiceError("not_found", "Contact not found");
      }

      const [deleted] = await repository.deleteForUser(contact.id, userId);
      if (!deleted) {
        throw new ContactServiceError("not_found", "Contact not found");
      }

      return deleted;
    },

    async listContactSegments(
      idOrEmail: string,
      userId: string,
    ): Promise<ContactSegmentListItem[]> {
      const contact = await repository.findByIdOrEmailForUser(
        idOrEmail,
        userId,
      );
      if (!contact) {
        throw new ContactServiceError("not_found", "Contact not found");
      }

      const segmentNames = normalizeSegments(contact.segments);
      const foundSegments = await repository.findSegmentsByNamesForUser(
        segmentNames,
        userId,
      );
      const byName = new Map(
        foundSegments.map((segment) => [segment.name, segment]),
      );

      return segmentNames
        .map((name) => byName.get(name) ?? null)
        .filter(
          (segment): segment is Pick<SegmentRow, "id" | "name" | "createdAt"> =>
            segment !== null,
        )
        .map((segment) => ({
          id: segment.id,
          name: segment.name,
          created_at: segment.createdAt,
        }));
    },

    async addContactToSegment(input: {
      idOrEmail: string;
      segmentId: string;
      userId: string;
    }): Promise<ContactSegmentMutationResult> {
      const [contact, segment] = await Promise.all([
        repository.findByIdOrEmailForUser(input.idOrEmail, input.userId),
        repository.findSegmentByIdForUser(input.segmentId, input.userId),
      ]);

      if (!contact) {
        throw new ContactServiceError("not_found", "Contact not found");
      }
      if (!segment) {
        throw new ContactServiceError("not_found", "Segment not found");
      }

      await repository.addContactToSegment(contact.id, segment.id);

      const existingSegments = normalizeSegments(contact.segments);
      if (!existingSegments.includes(segment.name)) {
        await repository.updateForUser(contact.id, input.userId, {
          segments: [...existingSegments, segment.name],
        });
      }

      return { contactId: contact.id, segmentId: segment.id };
    },

    async removeContactFromSegment(input: {
      idOrEmail: string;
      segmentId: string;
      userId: string;
    }): Promise<ContactSegmentMutationResult> {
      const [contact, segment] = await Promise.all([
        repository.findByIdOrEmailForUser(input.idOrEmail, input.userId),
        repository.findSegmentByIdForUser(input.segmentId, input.userId),
      ]);

      if (!contact) {
        throw new ContactServiceError("not_found", "Contact not found");
      }
      if (!segment) {
        throw new ContactServiceError("not_found", "Segment not found");
      }

      await repository.removeContactFromSegment(contact.id, segment.id);

      const existingSegments = normalizeSegments(contact.segments);
      if (existingSegments.includes(segment.name)) {
        await repository.updateForUser(contact.id, input.userId, {
          segments: existingSegments.filter((name) => name !== segment.name),
        });
      }

      return { contactId: contact.id, segmentId: segment.id };
    },
  };
}

export const contactService = createContactService();
