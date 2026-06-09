import { and, desc, eq, lt } from "drizzle-orm";
import {
  AutomationValidationError,
  assertEventNameAllowed,
} from "../../dto/automations";
import { db } from "../client";
import { customEventDeliveries, customEvents } from "../schema";

export interface CreateCustomEventInput {
  name: string;
  schema?: Record<string, unknown> | null;
  userId?: string | null;
}

export interface UpdateCustomEventInput {
  name?: string;
  schema?: Record<string, unknown> | null;
}

export interface RecordCustomEventDeliveryInput {
  eventName: string;
  payload: Record<string, unknown>;
  contactId?: string | null;
  email?: string | null;
  userId?: string | null;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export const customEventRepo = {
  async findById(id: string) {
    return await db.query.customEvents.findFirst({
      where: eq(customEvents.id, id),
    });
  },

  async findByIdForUser(id: string, userId?: string | null) {
    const conditions = [eq(customEvents.id, id)];
    if (userId) conditions.push(eq(customEvents.userId, userId));
    return await db.query.customEvents.findFirst({
      where: and(...conditions),
    });
  },

  async findByName(name: string, userId?: string | null) {
    const conditions = [eq(customEvents.name, name)];
    if (userId) conditions.push(eq(customEvents.userId, userId));
    return await db.query.customEvents.findFirst({
      where: and(...conditions),
    });
  },

  async create(input: CreateCustomEventInput) {
    assertEventNameAllowed(input.name);
    const [row] = await db
      .insert(customEvents)
      .values({
        name: input.name,
        schema: input.schema ?? null,
        userId: input.userId ?? null,
      })
      .returning();
    return row;
  },

  async list(
    options: { limit?: number; after?: string; userId?: string | null } = {},
  ) {
    const { limit = 50, after, userId } = options;
    const conditions = [];
    if (userId) conditions.push(eq(customEvents.userId, userId));
    if (after) conditions.push(lt(customEvents.id, after));

    const results = await db
      .select()
      .from(customEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(customEvents.id))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    return { data, hasMore };
  },

  async findByIdentifierForUser(identifier: string, userId?: string | null) {
    if (looksLikeUuid(identifier)) {
      const eventById = await customEventRepo.findByIdForUser(
        identifier,
        userId,
      );
      if (eventById) return eventById;
    }
    return await customEventRepo.findByName(identifier, userId);
  },

  async updateForUser(
    id: string,
    userId: string | null | undefined,
    input: UpdateCustomEventInput,
  ) {
    if (input.name !== undefined) assertEventNameAllowed(input.name);
    const conditions = [eq(customEvents.id, id)];
    if (userId) conditions.push(eq(customEvents.userId, userId));

    const [row] = await db
      .update(customEvents)
      .set({ ...input, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return row;
  },

  async delete(id: string) {
    return await db
      .delete(customEvents)
      .where(eq(customEvents.id, id))
      .returning({ id: customEvents.id });
  },

  async deleteForUser(id: string, userId?: string | null) {
    const conditions = [eq(customEvents.id, id)];
    if (userId) conditions.push(eq(customEvents.userId, userId));
    return await db
      .delete(customEvents)
      .where(and(...conditions))
      .returning({ id: customEvents.id });
  },
};

export const customEventDeliveryRepo = {
  async findById(id: string) {
    return await db.query.customEventDeliveries.findFirst({
      where: eq(customEventDeliveries.id, id),
    });
  },

  async record(input: RecordCustomEventDeliveryInput) {
    if (!input.eventName) {
      throw new AutomationValidationError(
        "event name is required",
        "event_name_required",
      );
    }
    assertEventNameAllowed(input.eventName);

    const [row] = await db
      .insert(customEventDeliveries)
      .values({
        eventName: input.eventName,
        payload: input.payload ?? {},
        contactId: input.contactId ?? null,
        email: input.email ?? null,
        userId: input.userId ?? null,
      })
      .returning();
    return row;
  },

  async listByEventName(
    eventName: string,
    options: { limit?: number; after?: string } = {},
  ) {
    const { limit = 50, after } = options;
    const conditions = [eq(customEventDeliveries.eventName, eventName)];
    if (after) conditions.push(lt(customEventDeliveries.id, after));

    const results = await db
      .select()
      .from(customEventDeliveries)
      .where(and(...conditions))
      .orderBy(desc(customEventDeliveries.receivedAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    return { data, hasMore };
  },
};
