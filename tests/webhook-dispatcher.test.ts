import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockUpdate = vi.fn();
const mockFindDispatchable = vi.fn();
const mockFindWebhookById = vi.fn();
const mockFindEventById = vi.fn();
const mockSignWebhookPayload = vi.fn();

vi.mock("@opensend/core", () => ({
  emailEventRepo: {
    findById: mockFindEventById,
  },
  signWebhookPayload: mockSignWebhookPayload,
  toWebhookEventType: (eventType: string) => {
    const candidate = eventType.includes(".")
      ? eventType
      : `email.${eventType}`;
    return [
      "email.sent",
      "email.delivered",
      "email.bounced",
      "email.complained",
      "email.delivery_delayed",
      "email.opened",
      "email.clicked",
      "email.failed",
    ].includes(candidate)
      ? candidate
      : null;
  },
  webhookDeliveryRepo: {
    create: mockCreate,
    findById: mockFindById,
    update: mockUpdate,
    findDispatchable: mockFindDispatchable,
  },
  webhookRepo: {
    findById: mockFindWebhookById,
  },
}));

describe("WebhookDispatcher", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useRealTimers();

    mockCreate.mockImplementation(async (data) => ({
      id: "delivery-new",
      ...data,
    }));
    mockFindDispatchable.mockResolvedValue([]);
    mockSignWebhookPayload.mockReturnValue("v1,test-signature");
  });

  it("enqueues a pending delivery with zero attempts", async () => {
    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher();

    const delivery = await dispatcher.enqueue("hook-1", "event-1");

    expect(mockCreate).toHaveBeenCalledWith({
      webhookId: "hook-1",
      eventId: "event-1",
      status: "pending",
      attempt: 0,
      nextRetryAt: null,
    });
    expect(delivery).toMatchObject({
      id: "delivery-new",
      webhookId: "hook-1",
      eventId: "event-1",
    });
  });

  it("dispatches a signed webhook and records a successful attempt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00.000Z"));

    mockFindById.mockResolvedValue({
      id: "delivery-1",
      webhookId: "hook-1",
      eventId: "event-1",
      attempt: 0,
      status: "pending",
    });
    mockFindWebhookById.mockResolvedValue({
      id: "hook-1",
      url: "https://example.com/webhook",
      status: "active",
      signingSecret: "whsec_test_secret",
    });
    mockFindEventById.mockResolvedValue({
      id: "event-1",
      type: "delivered",
      payload: { smtpResponse: "250 ok" },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "accepted",
    });
    mockUpdate.mockImplementation(async (_id, data) => ({
      id: "delivery-1",
      ...data,
    }));

    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher({ fetchImpl: fetchMock });

    const result = await dispatcher.dispatchDelivery("delivery-1");

    expect(mockSignWebhookPayload).toHaveBeenCalledWith(
      "whsec_test_secret",
      "whd_delivery-1_1",
      "1777334400",
      JSON.stringify({
        id: "whd_delivery-1_1",
        type: "email.delivered",
        created_at: "2026-04-28T00:00:00.000Z",
        data: { smtpResponse: "250 ok" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "svix-id": "whd_delivery-1_1",
        "svix-timestamp": "1777334400",
        "svix-signature": "v1,test-signature",
      },
      body: JSON.stringify({
        id: "whd_delivery-1_1",
        type: "email.delivered",
        created_at: "2026-04-28T00:00:00.000Z",
        data: { smtpResponse: "250 ok" },
      }),
      signal: expect.any(AbortSignal),
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      "delivery-1",
      expect.objectContaining({
        attempt: 1,
        status: "success",
        statusCode: 200,
        responseBody: "accepted",
        nextRetryAt: null,
        attemptedAt: new Date("2026-04-28T00:00:00.000Z"),
      }),
    );
    expect(result).toMatchObject({ status: "success", attempt: 1 });
  });

  it("marks unsupported event types terminal without sending", async () => {
    mockFindById.mockResolvedValue({
      id: "delivery-unsupported",
      webhookId: "hook-unsupported",
      eventId: "event-unsupported",
      attempt: 0,
      status: "pending",
    });
    mockFindWebhookById.mockResolvedValue({
      id: "hook-unsupported",
      url: "https://example.com/webhook",
      status: "active",
      signingSecret: "whsec_test_secret",
    });
    mockFindEventById.mockResolvedValue({
      id: "event-unsupported",
      type: "domain.updated",
      payload: {},
    });
    const fetchMock = vi.fn();
    mockUpdate.mockImplementation(async (_id, data) => ({
      id: "delivery-unsupported",
      ...data,
    }));

    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher({ fetchImpl: fetchMock });

    const result = await dispatcher.dispatchDelivery("delivery-unsupported");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      "delivery-unsupported",
      expect.objectContaining({
        status: "failed",
        responseBody: "Unsupported webhook event type: domain.updated",
        nextRetryAt: null,
      }),
    );
    expect(result).toMatchObject({ status: "failed" });
  });

  it("schedules the first retry after a failed response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00.000Z"));

    mockFindById.mockResolvedValue({
      id: "delivery-2",
      webhookId: "hook-2",
      eventId: "event-2",
      attempt: 0,
      status: "pending",
    });
    mockFindWebhookById.mockResolvedValue({
      id: "hook-2",
      url: "https://example.com/fail",
      status: "active",
      signingSecret: "whsec_test_secret",
    });
    mockFindEventById.mockResolvedValue({
      id: "event-2",
      type: "bounced",
      payload: { reason: "smtp 500" },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    });
    mockUpdate.mockImplementation(async (_id, data) => ({
      id: "delivery-2",
      ...data,
    }));

    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher({ fetchImpl: fetchMock });

    const result = await dispatcher.dispatchDelivery("delivery-2");

    expect(mockUpdate).toHaveBeenCalledWith(
      "delivery-2",
      expect.objectContaining({
        attempt: 1,
        status: "pending",
        statusCode: 500,
        responseBody: "server error",
        nextRetryAt: new Date("2026-04-28T00:00:10.000Z"),
      }),
    );
    expect(result).toMatchObject({ status: "pending", attempt: 1 });
  });

  it("marks a delivery dead-letter when the final attempt throws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-28T00:00:00.000Z"));

    mockFindById.mockResolvedValue({
      id: "delivery-3",
      webhookId: "hook-3",
      eventId: "event-3",
      attempt: 1,
      status: "pending",
    });
    mockFindWebhookById.mockResolvedValue({
      id: "hook-3",
      url: "https://example.com/timeout",
      status: "active",
      signingSecret: "whsec_test_secret",
    });
    mockFindEventById.mockResolvedValue({
      id: "event-3",
      type: "complained",
      payload: { reason: "abuse" },
    });
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));
    mockUpdate.mockImplementation(async (_id, data) => ({
      id: "delivery-3",
      ...data,
    }));

    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher({
      fetchImpl: fetchMock,
      maxAttempts: 2,
      retryDelaysSeconds: [10],
    });

    const result = await dispatcher.dispatchDelivery("delivery-3");

    expect(mockUpdate).toHaveBeenCalledWith(
      "delivery-3",
      expect.objectContaining({
        attempt: 2,
        status: "dead_letter",
        statusCode: null,
        responseBody: "timeout",
        nextRetryAt: null,
      }),
    );
    expect(result).toMatchObject({ status: "dead_letter", attempt: 2 });
  });

  it("marks disabled webhooks terminal without sending", async () => {
    mockFindById.mockResolvedValue({
      id: "delivery-4",
      webhookId: "hook-4",
      eventId: "event-4",
      attempt: 0,
      status: "pending",
    });
    mockFindWebhookById.mockResolvedValue({
      id: "hook-4",
      url: "https://example.com/disabled",
      status: "disabled",
      signingSecret: "whsec_test_secret",
    });
    const fetchMock = vi.fn();
    mockUpdate.mockImplementation(async (_id, data) => ({
      id: "delivery-4",
      ...data,
    }));

    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher({ fetchImpl: fetchMock });

    const result = await dispatcher.dispatchDelivery("delivery-4");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      "delivery-4",
      expect.objectContaining({
        status: "failed",
        responseBody: "Webhook is disabled",
        nextRetryAt: null,
      }),
    );
    expect(result).toMatchObject({ status: "failed" });
  });

  it("loads and processes dispatchable pending deliveries", async () => {
    mockFindDispatchable.mockResolvedValue([
      { id: "delivery-a" },
      { id: "delivery-b" },
    ]);
    mockFindById
      .mockResolvedValueOnce({
        id: "delivery-a",
        webhookId: "hook-a",
        eventId: "event-a",
        attempt: 0,
        status: "pending",
      })
      .mockResolvedValueOnce({
        id: "delivery-b",
        webhookId: "hook-b",
        eventId: "event-b",
        attempt: 0,
        status: "pending",
      });
    mockFindWebhookById
      .mockResolvedValueOnce({
        id: "hook-a",
        url: "https://example.com/a",
        status: "active",
        signingSecret: "whsec_test_secret",
      })
      .mockResolvedValueOnce({
        id: "hook-b",
        url: "https://example.com/b",
        status: "active",
        signingSecret: "whsec_test_secret",
      });
    mockFindEventById
      .mockResolvedValueOnce({ id: "event-a", type: "delivered", payload: {} })
      .mockResolvedValueOnce({ id: "event-b", type: "bounced", payload: {} });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });
    mockUpdate.mockImplementation(async (id, data) => ({ id, ...data }));

    const { WebhookDispatcher } = await import(
      "../packages/ingester/src/dispatcher"
    );
    const dispatcher = new WebhookDispatcher({ fetchImpl: fetchMock });

    const result = await dispatcher.dispatchPendingDeliveries({ limit: 2 });

    expect(mockFindDispatchable).toHaveBeenCalledWith({ limit: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.processed).toBe(2);
  });
});
