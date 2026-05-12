import {
  batchSendEmailResponseSchema,
  batchSendEmailSchema,
  normalizeEmailRecipient,
  publicApiError,
  publicApiErrorEnvelopeSchema,
  sendEmailResponseSchema,
  sendEmailSchema,
  zodValidationDetails,
} from "@opensend/core";
import type {
  BatchSendEmailRequest,
  BatchSendEmailResponseBody,
  SendEmailRequest,
  SendEmailSuccessResponse,
} from "@opensend/core";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  BatchEmailResponse,
  EmailResponse,
  SendEmailPayload,
} from "../packages/sdk/src";

const validSendPayload = {
  from: "sender@example.com",
  to: "user@example.com",
  cc: ["copy@example.com"],
  bcc: "audit@example.com",
  reply_to: "reply@example.com",
  subject: "Shared contract",
  html: "<p>Hello</p>",
  headers: { "X-Campaign": "contract" },
  tags: [{ name: "issue", value: "442" }],
  scheduled_at: "in 5 minutes",
  topic_id: "00000000-0000-4000-8000-000000000442",
  extra_app_internal: "stripped",
};

describe("send email public contract boundary", () => {
  it("validates public send requests and normalizes recipient fields without app internals", () => {
    const parsed = sendEmailSchema.parse(validSendPayload);

    expect(parsed).toMatchObject({
      from: "sender@example.com",
      to: "user@example.com",
      reply_to: "reply@example.com",
      scheduled_at: "in 5 minutes",
      topic_id: "00000000-0000-4000-8000-000000000442",
    });
    expect(parsed).not.toHaveProperty("extra_app_internal");
    expect(normalizeEmailRecipient(parsed.to)).toEqual(["user@example.com"]);
    expect(normalizeEmailRecipient(parsed.cc)).toEqual(["copy@example.com"]);
    expect(normalizeEmailRecipient(parsed.bcc)).toEqual(["audit@example.com"]);
    expect(normalizeEmailRecipient(parsed.reply_to)).toEqual([
      "reply@example.com",
    ]);
  });

  it("validates batch request size and item-level send requirements", () => {
    const validBatch = batchSendEmailSchema.parse([
      validSendPayload,
      { ...validSendPayload, to: ["two@example.com"], text: "Fallback" },
    ]);
    expect(validBatch).toHaveLength(2);

    const invalidBatch = batchSendEmailSchema.safeParse([
      {
        from: "sender@example.com",
        to: "user@example.com",
        subject: "No body",
      },
    ]);
    expect(invalidBatch.success).toBe(false);
    if (!invalidBatch.success) {
      const details = zodValidationDetails(invalidBatch.error);
      expect(details.fieldErrors["0.html"]).toContain(
        "html, text, or template is required",
      );
    }

    const oversized = batchSendEmailSchema.safeParse(
      Array.from({ length: 101 }, () => validSendPayload),
    );
    expect(oversized.success).toBe(false);
  });

  it("defines public success response fields and casing for send and batch send", () => {
    expect(sendEmailResponseSchema.parse({ id: "email_123" })).toEqual({
      id: "email_123",
    });
    expect(
      sendEmailResponseSchema.safeParse({ id: "email_123", object: "email" })
        .success,
    ).toBe(false);

    const batchBody = {
      data: [
        { id: "email_123" },
        {
          error: publicApiError(
            "recipient_suppressed",
            "Recipient suppressed.",
            422,
            { recipients: "blocked@example.com", reason: "suppressed" },
          ),
        },
      ],
    };

    expect(batchSendEmailResponseSchema.parse(batchBody)).toEqual(batchBody);
  });

  it("keeps public error envelopes parseable with validation details and status codes", () => {
    const result = sendEmailSchema.safeParse({ from: "sender@example.com" });
    expect(result.success).toBe(false);
    if (result.success) return;

    const envelope = publicApiError(
      "validation_error",
      "Validation failed.",
      422,
      zodValidationDetails(result.error),
    );

    expect(publicApiErrorEnvelopeSchema.parse(envelope)).toMatchObject({
      name: "validation_error",
      code: "validation_error",
      message: "Validation failed.",
      statusCode: 422,
      details: {
        fieldErrors: {
          to: [expect.any(String)],
          subject: [expect.any(String)],
        },
      },
    });
  });

  it("keeps SDK send and batch types compatible with the shared contract DTOs", () => {
    expectTypeOf<SendEmailPayload>().toMatchTypeOf<SendEmailRequest>();
    expectTypeOf<SendEmailRequest>().toMatchTypeOf<SendEmailPayload>();
    expectTypeOf<BatchSendEmailRequest>().toMatchTypeOf<SendEmailPayload[]>();
    expectTypeOf<EmailResponse>().toEqualTypeOf<SendEmailSuccessResponse>();
    const sdkBatchResponse: BatchEmailResponse = {
      data: [
        { id: "email_123" },
        {
          error: publicApiError(
            "recipient_suppressed",
            "Recipient suppressed.",
            422,
          ),
        },
      ],
    };
    const contractBatchResponse: BatchSendEmailResponseBody = sdkBatchResponse;
    const sdkRoundTrip: BatchEmailResponse = contractBatchResponse;
    expect(sdkRoundTrip).toEqual(sdkBatchResponse);
  });
});
