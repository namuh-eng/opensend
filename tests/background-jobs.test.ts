import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSqsSend = vi.hoisted(() => vi.fn());
const mockEventBridgeSend = vi.hoisted(() => vi.fn());
const mockSqsClient = vi.hoisted(() => vi.fn());
const mockEventBridgeClient = vi.hoisted(() => vi.fn());
const mockSendMessageCommand = vi.hoisted(() => vi.fn());
const mockPutEventsCommand = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: mockSqsClient.mockImplementation(() => ({ send: mockSqsSend })),
  SendMessageCommand: mockSendMessageCommand.mockImplementation((input) => ({
    input,
    type: "SendMessageCommand",
  })),
}));

vi.mock("@aws-sdk/client-eventbridge", () => ({
  EventBridgeClient: mockEventBridgeClient.mockImplementation(() => ({
    send: mockEventBridgeSend,
  })),
  PutEventsCommand: mockPutEventsCommand.mockImplementation((input) => ({
    input,
    type: "PutEventsCommand",
  })),
}));

describe("background job publisher", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSqsClient.mockImplementation(() => ({ send: mockSqsSend }));
    mockEventBridgeClient.mockImplementation(() => ({
      send: mockEventBridgeSend,
    }));
    mockSendMessageCommand.mockImplementation((input) => ({
      input,
      type: "SendMessageCommand",
    }));
    mockPutEventsCommand.mockImplementation((input) => ({
      input,
      type: "PutEventsCommand",
    }));
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.AWS_REGION = "us-east-1";
    process.env.BACKGROUND_JOBS_QUEUE_URL = "";
    process.env.BACKGROUND_JOBS_EVENT_BUS_NAME = "";
    process.env.BACKGROUND_JOBS_REQUIRE_QUEUE = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips publishing when no queue URL is configured", async () => {
    const { createBackgroundJob, publishBackgroundJob } = await import(
      "../packages/core/src/jobs/background-jobs"
    );

    const result = await publishBackgroundJob(
      createBackgroundJob({
        id: "email.send:email-1",
        type: "email.send",
        source: "api",
        emailId: "email-1",
        requestedAt: "2026-04-28T00:00:00.000Z",
      }),
    );

    expect(result).toEqual({
      status: "skipped",
      reason: "queue_url_missing",
    });
    expect(mockSqsClient).not.toHaveBeenCalled();
  });

  it("publishes SQS jobs and optional EventBridge lifecycle events", async () => {
    process.env.BACKGROUND_JOBS_QUEUE_URL =
      "https://sqs.us-east-1.amazonaws.com/123/background.fifo";
    process.env.BACKGROUND_JOBS_EVENT_BUS_NAME = "opensend-jobs";
    mockSqsSend.mockResolvedValue({ MessageId: "sqs-message-1" });
    mockEventBridgeSend.mockResolvedValue({ Entries: [{ EventId: "evt-1" }] });

    const { createBackgroundJob, publishBackgroundJob } = await import(
      "../packages/core/src/jobs/background-jobs"
    );

    const job = createBackgroundJob({
      id: "webhook.dispatch:delivery-1",
      type: "webhook.dispatch",
      source: "ses-ingest",
      deliveryId: "delivery-1",
      requestedAt: "2026-04-28T00:00:00.000Z",
    });

    await expect(
      publishBackgroundJob(job, {
        delaySeconds: 9999,
        deduplicationId: "delivery-1",
        groupId: "webhook.dispatch",
      }),
    ).resolves.toEqual({
      status: "published",
      messageId: "sqs-message-1",
      eventId: "evt-1",
    });

    expect(mockSendMessageCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        QueueUrl: process.env.BACKGROUND_JOBS_QUEUE_URL,
        DelaySeconds: 900,
        MessageAttributes: expect.objectContaining({
          correlationId: expect.objectContaining({
            DataType: "String",
            StringValue: expect.any(String),
          }),
          traceparent: expect.objectContaining({
            DataType: "String",
            StringValue: expect.stringMatching(
              /^00-[a-f0-9]{32}-[a-f0-9]{16}-0[01]$/,
            ),
          }),
        }),
        MessageDeduplicationId: "delivery-1",
        MessageGroupId: "webhook.dispatch",
      }),
    );
    const sentBody = JSON.parse(
      mockSendMessageCommand.mock.calls[0]?.[0]?.MessageBody ?? "{}",
    );
    expect(sentBody).toMatchObject({
      id: job.id,
      type: job.type,
      source: job.source,
      deliveryId: "delivery-1",
      trace: {
        correlationId: expect.any(String),
        traceparent: expect.stringMatching(
          /^00-[a-f0-9]{32}-[a-f0-9]{16}-0[01]$/,
        ),
      },
    });
    expect(mockPutEventsCommand).toHaveBeenCalledWith({
      Entries: [
        expect.objectContaining({
          EventBusName: "opensend-jobs",
          Source: "opensend.background-jobs",
          DetailType: "webhook.dispatch",
        }),
      ],
    });
  });

  it("parses supported job payloads and rejects invalid ones", async () => {
    const { parseBackgroundJob } = await import(
      "../packages/core/src/jobs/background-jobs"
    );

    expect(
      parseBackgroundJob(
        JSON.stringify({
          id: "scheduled-email.scan:tick",
          type: "scheduled-email.scan",
          source: "eventbridge",
          requestedAt: "2026-04-28T00:00:00.000Z",
          limit: 25,
          trace: {
            traceparent:
              "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
            correlationId: "corr-1",
          },
        }),
      ),
    ).toEqual({
      id: "scheduled-email.scan:tick",
      type: "scheduled-email.scan",
      source: "eventbridge",
      requestedAt: "2026-04-28T00:00:00.000Z",
      limit: 25,
      trace: {
        traceparent: "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
        correlationId: "corr-1",
      },
    });

    expect(() => parseBackgroundJob("{}")).toThrow(/id/);
  });
});
