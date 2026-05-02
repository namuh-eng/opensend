import { emailRepo } from "../db/repositories/emailRepo";
import {
  createBackgroundJob,
  publishBackgroundJob,
} from "../jobs/background-jobs";

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
      );
      if (existing) return { id: existing.id, duplicate: true };
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
        await emailRepo.update(record.id, { status: "failed" });
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
      const chunkRes = await Promise.all(chunk.map((item) => this.send(item)));
      results.push(...chunkRes);
    }
    return results;
  }
}

export const emailService = new EmailService();
