import { emailEventRepo } from "../db/repositories/emailEventRepo";
import { emailRepo } from "../db/repositories/emailRepo";
import { suppressionRepo } from "../db/repositories/suppressionRepo";
import {
  createBackgroundJob,
  publishBackgroundJob,
} from "../jobs/background-jobs";

function summarizeQueuePublishError(error: unknown): {
  code: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      code: error.name || "queue_publish_failed",
      message: error.message.slice(0, 1_000),
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const code =
      typeof record.code === "string"
        ? record.code
        : typeof record.name === "string"
          ? record.name
          : "queue_publish_failed";
    const message =
      typeof record.message === "string"
        ? record.message
        : "Failed to publish email send job.";
    return { code, message: message.slice(0, 1_000) };
  }

  return {
    code: "queue_publish_failed",
    message: "Failed to publish email send job.",
  };
}

export class SuppressedRecipientError extends Error {
  readonly code = "recipient_suppressed";
  readonly statusCode = 422;

  constructor(readonly recipients: Array<{ email: string; reason: string }>) {
    const first = recipients[0];
    super(
      first
        ? `Recipient ${first.email} is suppressed because it ${first.reason}.`
        : "One or more recipients are suppressed.",
    );
    this.name = "SuppressedRecipientError";
  }
}

export class EmailService {
  async send(params: {
    from: string;
    to: string[];
    subject: string;
    html?: string;
    text?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string[];
    headers?: Record<string, string>;
    attachments?: Array<{ filename: string; content: string }>;
    tags?: Array<{ name: string; value: string }>;
    scheduledAt?: Date | null;
    topicId?: string | null;
    idempotencyKey?: string | null;
    userId?: string | null;
  }) {
    // Check idempotency if key provided
    if (params.idempotencyKey) {
      const existing = await emailRepo.findByIdempotencyKey(
        params.idempotencyKey,
        params.userId,
      );
      if (existing) return { id: existing.id, duplicate: true };
    }

    const suppressed = await suppressionRepo.findByUserAndEmails(
      params.userId,
      params.to,
    );
    if (suppressed.length > 0) {
      throw new SuppressedRecipientError(
        suppressed.map((entry) => ({
          email: entry.email,
          reason: entry.reason,
        })),
      );
    }

    const shouldQueueNow =
      !params.scheduledAt || params.scheduledAt <= new Date();

    const [record] = await emailRepo.create({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html || "",
      text: params.text || "",
      cc: params.cc ?? [],
      bcc: params.bcc ?? [],
      replyTo: params.replyTo ?? [],
      headers: params.headers ?? {},
      attachments: params.attachments ?? [],
      tags: params.tags ?? [],
      status: shouldQueueNow ? "queued" : "scheduled",
      scheduledAt: params.scheduledAt,
      topicId: params.topicId,
      idempotencyKey: params.idempotencyKey,
      userId: params.userId,
    });

    if (shouldQueueNow) {
      try {
        await publishBackgroundJob(
          createBackgroundJob({
            id: `email.send:${record.id}`,
            type: "email.send",
            source: "api",
            emailId: record.id,
          }),
          {
            deduplicationId: `email.send:${record.id}`,
            groupId: "email.send",
          },
        );
      } catch (error) {
        const failedAt = new Date();
        const errorSummary = summarizeQueuePublishError(error);
        await emailRepo.update(
          record.id,
          {
            status: "failed",
            providerLastAttemptedAt: failedAt,
            providerLastErrorCode: errorSummary.code,
            providerLastErrorMessage: errorSummary.message,
            providerNextRetryAt: null,
            providerDeadLetteredAt: failedAt,
          },
          params.userId,
        );
        await emailEventRepo.create({
          emailId: record.id,
          userId: params.userId,
          sourceId: `queue-publish-failed:${record.id}`,
          type: "failed",
          payload: {
            reason: "queue_publish_failed",
            error: errorSummary,
          },
          receivedAt: failedAt,
        });
        throw error;
      }
    }

    return { id: record.id, providerId: null };
  }

  async sendBatch(items: Parameters<EmailService["send"]>[0][]) {
    // Encapsulate 5-at-a-time concurrency
    const CONCURRENCY = 5;
    const results = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const chunkRes = await Promise.all(
        chunk.map(async (item) => {
          try {
            return await this.send(item);
          } catch (error) {
            if (error instanceof SuppressedRecipientError) {
              return { error };
            }
            throw error;
          }
        }),
      );
      results.push(...chunkRes);
    }
    return results;
  }
}

export const emailService = new EmailService();
