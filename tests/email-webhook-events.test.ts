import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("../packages/core/src/db/client", () => ({
  db: {
    transaction: mockTransaction,
  },
}));

describe("enqueueEmailWebhookEvent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it.each([
    ["email.scheduled", "scheduled"],
    ["email.delayed", "delayed"],
    ["email.suppressed", "suppressed"],
  ] as const)(
    "persists %s and tenant-scoped pending delivery rows",
    async (webhookEventType, storedEventType) => {
      const selectWhere = vi.fn(() => Promise.resolve([{ id: "hook-1" }]));
      const tx = {
        insert: vi.fn((table: unknown) => {
          const tableName = getTableName(table as never);
          if (tableName === "email_events") {
            return {
              values: vi.fn((value: unknown) => ({
                returning: vi.fn(async () => [{ id: "event-1", value }]),
              })),
            };
          }
          if (tableName === "webhook_deliveries") {
            return {
              values: vi.fn((value: unknown) => ({
                returning: vi.fn(async () => [{ id: "delivery-1", value }]),
              })),
            };
          }
          throw new Error(`Unexpected insert table: ${tableName}`);
        }),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: selectWhere,
          })),
        })),
      };
      mockTransaction.mockImplementation(
        async (callback) => await callback(tx),
      );

      const { enqueueEmailWebhookEvent } = await import(
        "../packages/core/src/services/email-webhook-events"
      );
      const receivedAt = new Date("2026-05-28T00:00:00.000Z");
      const result = await enqueueEmailWebhookEvent({
        type: webhookEventType,
        userId: "user-1",
        emailId: "email-1",
        sourceId: `${storedEventType}:email-1`,
        payload: {
          email_id: "email-1",
          happened_at: receivedAt.toISOString(),
        },
        receivedAt,
      });

      expect(result).toEqual({
        eventId: "event-1",
        deliveryIds: ["delivery-1"],
      });
      const eventValues =
        tx.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
      expect(eventValues).toMatchObject({
        emailId: "email-1",
        sourceId: `${storedEventType}:email-1`,
        type: storedEventType,
        payload: {
          email_id: "email-1",
          happened_at: receivedAt.toISOString(),
        },
        userId: "user-1",
        receivedAt,
      });
      const deliveryValues =
        tx.insert.mock.results[1]?.value.values.mock.calls[0]?.[0];
      expect(deliveryValues).toEqual([
        {
          webhookId: "hook-1",
          eventId: "event-1",
          status: "pending",
          attempt: 0,
          nextRetryAt: null,
        },
      ]);
      expect(selectWhere).toHaveBeenCalledTimes(1);
    },
  );

  it("rejects unsupported email webhook types before writing", async () => {
    const { enqueueEmailWebhookEvent } = await import(
      "../packages/core/src/services/email-webhook-events"
    );

    await expect(
      enqueueEmailWebhookEvent({
        type: "email.received" as never,
        userId: "user-1",
        payload: {},
      }),
    ).rejects.toThrow("Unsupported webhook event type: email.received");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
