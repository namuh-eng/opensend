import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../client";
import { inboundProviderEvents } from "../schema";

export type InboundProviderEventStatus =
  | "processing"
  | "processed"
  | "malformed_mime"
  | "missing_domain"
  | "oversized_message"
  | "storage_failure"
  | "duplicate_provider_event";

type CreateProcessingInput = {
  provider: string;
  providerEventId: string;
  providerMessageId?: string | null;
  rawMetadata: Record<string, unknown>;
};

type MarkTerminalInput = {
  id: string;
  status: Exclude<
    InboundProviderEventStatus,
    "processing" | "processed" | "duplicate_provider_event"
  >;
  terminalReason: string;
  userId?: string | null;
};

type MarkProcessedInput = {
  id: string;
  userId: string;
  receivedEmailId: string;
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export const inboundProviderEventRepo = {
  async findPrimary(provider: string, providerEventId: string) {
    return await db.query.inboundProviderEvents.findFirst({
      where: and(
        eq(inboundProviderEvents.provider, provider),
        eq(inboundProviderEvents.providerEventId, providerEventId),
        ne(inboundProviderEvents.status, "duplicate_provider_event"),
      ),
      orderBy: desc(inboundProviderEvents.createdAt),
    });
  },

  async createProcessing(input: CreateProcessingInput) {
    const existing = await this.findPrimary(
      input.provider,
      input.providerEventId,
    );
    if (existing) return { event: existing, created: false as const };

    try {
      const [event] = await db
        .insert(inboundProviderEvents)
        .values({
          provider: input.provider,
          providerEventId: input.providerEventId,
          providerMessageId: input.providerMessageId ?? null,
          rawMetadata: input.rawMetadata,
          status: "processing",
        })
        .returning();
      return { event, created: true as const };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const conflicting = await this.findPrimary(
        input.provider,
        input.providerEventId,
      );
      if (!conflicting) throw error;
      return { event: conflicting, created: false as const };
    }
  },

  async createDuplicate(input: {
    provider: string;
    providerEventId: string;
    providerMessageId?: string | null;
    rawMetadata: Record<string, unknown>;
    duplicateOfEventId: string;
    userId?: string | null;
  }) {
    const [event] = await db
      .insert(inboundProviderEvents)
      .values({
        provider: input.provider,
        providerEventId: input.providerEventId,
        providerMessageId: input.providerMessageId ?? null,
        rawMetadata: input.rawMetadata,
        status: "duplicate_provider_event",
        terminalReason: "Provider event id has already been ingested",
        duplicateOfEventId: input.duplicateOfEventId,
        userId: input.userId ?? null,
      })
      .returning();
    return event;
  },

  async markTerminal(input: MarkTerminalInput) {
    const [event] = await db
      .update(inboundProviderEvents)
      .set({
        status: input.status,
        terminalReason: input.terminalReason,
        userId: input.userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(inboundProviderEvents.id, input.id))
      .returning();
    return event;
  },

  async markProcessed(input: MarkProcessedInput) {
    const [event] = await db
      .update(inboundProviderEvents)
      .set({
        status: "processed",
        terminalReason: null,
        userId: input.userId,
        receivedEmailId: input.receivedEmailId,
        updatedAt: new Date(),
      })
      .where(eq(inboundProviderEvents.id, input.id))
      .returning();
    return event;
  },
};
