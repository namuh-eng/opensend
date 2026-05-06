import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    transaction: mockTransaction,
  },
}));

describe("lifecycle webhook event queue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("persists a tenant-scoped lifecycle event and pending delivery rows", async () => {
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
    mockTransaction.mockImplementation(async (callback) => await callback(tx));

    const { queueEvent } = await import("@/lib/events");
    const result = await queueEvent({
      type: "contact.created",
      userId: "user-1",
      payload: { id: "contact-1", email: "a@example.com" },
    });

    expect(result).toEqual({ eventId: "event-1", deliveryIds: ["delivery-1"] });
    expect(tx.insert).toHaveBeenCalledTimes(2);
    const eventValues =
      tx.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(eventValues).toMatchObject({
      emailId: null,
      sourceId: null,
      type: "contact.created",
      payload: { id: "contact-1", email: "a@example.com" },
      userId: "user-1",
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
  });

  it("rejects unsupported event types before writing", async () => {
    const { queueEvent } = await import("@/lib/events");

    await expect(
      queueEvent({
        type: "email.unknown" as never,
        userId: "user-1",
        payload: {},
      }),
    ).rejects.toThrow("Unsupported webhook event type: email.unknown");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
