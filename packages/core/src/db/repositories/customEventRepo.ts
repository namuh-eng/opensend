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

export interface RecordCustomEventDeliveryInput {
  eventName: string;
  payload: Record<string, unknown>;
  contactId?: string | null;
  email?: string | null;
  userId?: string | null;
}

export const customEventRepo = {
  async findById(id: string) {
    return await db.query.customEvents.findFirst({
      where: eq(customEvents.id, id),
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

  async delete(id: string) {
    return await db
      .delete(customEvents)
      .where(eq(customEvents.id, id))
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
