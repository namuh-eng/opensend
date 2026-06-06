import { createHash, randomUUID } from "node:crypto";
import { db } from "../db/client";
import { inboundProviderEventRepo } from "../db/repositories/inboundProviderEventRepo";
import { emailEvents, receivedEmails } from "../db/schema";
import {
  UnsafeOutboundUrlError,
  safeOutboundFetch,
} from "../security/url-safety";
import { forwardingRuleService } from "./forwardingRules";
import {
  InboundMimeParseError,
  type ParsedInboundMime,
  parseInboundMime,
} from "./inboundMime";
import {
  type ReceivingRouteDecision,
  createReceivingRouteService,
} from "./receivingRoutes";
import {
  hasInboundReplyTokenCandidate,
  resolveInboundReply,
} from "./replyThreading";
import { storageService } from "./storage";

export type InboundProviderNotification = {
  provider: string;
  eventId: string;
  messageId?: string | null;
  recipients?: string[];
  rawMime?: string;
  rawMimeBase64?: string;
  rawMimeUrl?: string;
  metadata?: Record<string, unknown>;
};

export type InboundEmailIngestionStatus =
  | "processed"
  | "malformed_mime"
  | "missing_domain"
  | "oversized_message"
  | "storage_failure"
  | "duplicate_provider_event";

export type InboundEmailIngestionOutcome =
  | {
      status: "processed";
      provider_event_id: string;
      received_email_id: string;
      event_id: string;
      user_id: string;
      attachments: number;
    }
  | {
      status: Exclude<InboundEmailIngestionStatus, "processed">;
      provider_event_id: string;
      reason: string;
      duplicate_of_event_id?: string;
    };

export type InboundEmailIngestionDependencies = {
  safeFetch?: typeof safeOutboundFetch;
  uploadFile?: (
    key: string,
    body: Buffer,
    contentType: string,
  ) => Promise<{ key: string; url: string }>;
  deleteFile?: (key: string) => Promise<void>;
  maxBytes?: number;
};

type StoredAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  s3Key: string;
};

const DEFAULT_PROVIDER = "generic";
const MAX_METADATA_STRING = 512;
const DEFAULT_MAX_RAW_MIME_BYTES = 25 * 1024 * 1024;
const RAW_MIME_FETCH_TIMEOUT_MS = 10_000;
const SECRET_KEY_PATTERN = /secret|token|authorization|signature|password|key/i;

function normalizeProvider(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized || DEFAULT_PROVIDER;
}

function normalizeEventId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("Inbound provider event id is required");
  return normalized;
}

function sanitizeMetadata(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      result[key] = "[redacted]";
      continue;
    }
    if (typeof raw === "string") {
      result[key] =
        raw.length > MAX_METADATA_STRING
          ? `${raw.slice(0, MAX_METADATA_STRING)}…`
          : raw;
      continue;
    }
    if (
      typeof raw === "number" ||
      typeof raw === "boolean" ||
      raw === null ||
      Array.isArray(raw)
    ) {
      result[key] = raw;
    }
  }
  return result;
}

function decodeRawMime(input: InboundProviderNotification): Buffer | null {
  if (input.rawMimeBase64) {
    return Buffer.from(input.rawMimeBase64, "base64");
  }
  if (input.rawMime) {
    return Buffer.from(input.rawMime, "utf8");
  }
  return null;
}

async function fetchRawMime(
  input: InboundProviderNotification,
  safeFetch: typeof safeOutboundFetch,
  maxBytes = DEFAULT_MAX_RAW_MIME_BYTES,
): Promise<Buffer> {
  const local = decodeRawMime(input);
  if (local) return local;

  if (!input.rawMimeUrl) {
    throw new InboundMimeParseError(
      "malformed_mime",
      "Inbound provider notification did not include a raw MIME payload",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    RAW_MIME_FETCH_TIMEOUT_MS,
  );

  try {
    let response: Response;
    try {
      response = await safeFetch(
        input.rawMimeUrl,
        {
          headers: { Accept: "message/rfc822, text/plain, */*" },
          redirect: "error",
          signal: controller.signal,
        },
        { context: "dispatch" },
      );
    } catch (error) {
      if (error instanceof UnsafeOutboundUrlError) {
        throw new InboundMimeParseError(
          "malformed_mime",
          "Raw MIME URL is not allowed",
        );
      }
      throw error;
    }
    if (!response.ok) {
      throw new InboundMimeParseError(
        "malformed_mime",
        `Raw MIME fetch failed with HTTP ${response.status}`,
      );
    }
    return await readResponseBufferWithLimit(response, maxBytes);
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBufferWithLimit(
  response: Response,
  maxBytes: number,
): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > maxBytes
  ) {
    throw new InboundMimeParseError(
      "oversized_message",
      `MIME payload exceeds ${maxBytes} bytes`,
    );
  }

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new InboundMimeParseError(
        "oversized_message",
        `MIME payload exceeds ${maxBytes} bytes`,
      );
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const result = await reader.read();
    if (result.done) break;

    totalBytes += result.value.byteLength;
    if (totalBytes > maxBytes) {
      throw new InboundMimeParseError(
        "oversized_message",
        `MIME payload exceeds ${maxBytes} bytes`,
      );
    }
    chunks.push(result.value);
  }

  return Buffer.concat(chunks, totalBytes);
}

function mergeRecipients(
  parsed: ParsedInboundMime,
  providerRecipients: string[] | undefined,
): string[] {
  return [
    ...new Set(
      [...(providerRecipients ?? []), ...parsed.recipients]
        .map((recipient) => recipient.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function routeableDecision(
  decision: ReceivingRouteDecision & { userId?: string },
): decision is ReceivingRouteDecision & { userId: string } {
  return decision.status !== "unrouteable" && Boolean(decision.userId);
}

function resolveSingleTenant(
  decisions: Array<ReceivingRouteDecision & { userId?: string }>,
): { userId: string; routeable: ReceivingRouteDecision[] } | null {
  const routeable = decisions.filter(routeableDecision);
  const userIds = [...new Set(routeable.map((decision) => decision.userId))];
  if (userIds.length !== 1) return null;
  return { userId: userIds[0], routeable };
}

function resolveSingleCandidateTenant(
  decisions: Array<ReceivingRouteDecision & { userId?: string }>,
): string | null {
  const userIds = [
    ...new Set(
      decisions
        .map((decision) => decision.userId)
        .filter((userId): userId is string => Boolean(userId)),
    ),
  ];
  return userIds.length === 1 ? userIds[0] : null;
}

function terminalReasonForRouting(
  decisions: Array<ReceivingRouteDecision & { userId?: string }>,
): string {
  const routeable = decisions.filter(routeableDecision);
  if (routeable.length === 0) {
    return "No verified receiving domain route matched the inbound recipients";
  }
  return "Inbound recipients resolved to more than one tenant";
}

function attachmentObjectKey(input: {
  receivedEmailId: string;
  attachmentId: string;
  filename: string;
  content: Buffer;
}): string {
  const digest = createHash("sha256")
    .update(input.filename)
    .update(input.content)
    .digest("hex")
    .slice(0, 16);
  const safeName = input.filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return `received/${input.receivedEmailId}/${input.attachmentId}-${digest}-${safeName}`;
}

async function cleanupStoredAttachments(
  keys: string[],
  deleteFile: (key: string) => Promise<void>,
): Promise<void> {
  for (const key of keys) {
    try {
      await deleteFile(key);
    } catch {
      // Best effort cleanup only; do not hide the original ingestion failure.
    }
  }
}

export function createInboundEmailIngestionService(
  dependencies: InboundEmailIngestionDependencies = {},
) {
  const safeFetch = dependencies.safeFetch ?? safeOutboundFetch;
  const uploadFile =
    dependencies.uploadFile ?? storageService.uploadFile.bind(storageService);
  const deleteFile =
    dependencies.deleteFile ?? storageService.deleteFile.bind(storageService);
  const maxBytes = dependencies.maxBytes;
  const receivingRouteService = createReceivingRouteService();

  async function markTerminal(input: {
    eventId: string;
    providerEventId: string;
    status: Exclude<
      InboundEmailIngestionStatus,
      "processed" | "duplicate_provider_event"
    >;
    reason: string;
    userId?: string | null;
  }): Promise<InboundEmailIngestionOutcome> {
    await inboundProviderEventRepo.markTerminal({
      id: input.eventId,
      status: input.status,
      terminalReason: input.reason,
      userId: input.userId,
    });
    return {
      status: input.status,
      provider_event_id: input.providerEventId,
      reason: input.reason,
    };
  }

  return {
    async process(
      notification: InboundProviderNotification,
    ): Promise<InboundEmailIngestionOutcome> {
      const provider = normalizeProvider(notification.provider);
      const providerEventId = normalizeEventId(notification.eventId);
      const rawMetadata = sanitizeMetadata({
        ...(notification.metadata ?? {}),
        raw_mime_url: notification.rawMimeUrl,
        recipient_count: notification.recipients?.length ?? null,
      });

      const created = await inboundProviderEventRepo.createProcessing({
        provider,
        providerEventId,
        providerMessageId: notification.messageId ?? null,
        rawMetadata,
      });

      if (!created.created) {
        const duplicate = await inboundProviderEventRepo.createDuplicate({
          provider,
          providerEventId,
          providerMessageId: notification.messageId ?? null,
          rawMetadata,
          duplicateOfEventId: created.event.id,
          userId: created.event.userId,
        });
        return {
          status: "duplicate_provider_event",
          provider_event_id: providerEventId,
          reason: "Provider event id has already been ingested",
          duplicate_of_event_id:
            duplicate.duplicateOfEventId ?? created.event.id,
        };
      }

      let parsed: ParsedInboundMime;
      try {
        parsed = parseInboundMime(
          await fetchRawMime(notification, safeFetch, maxBytes),
          { maxBytes },
        );
      } catch (error) {
        if (error instanceof InboundMimeParseError) {
          return await markTerminal({
            eventId: created.event.id,
            providerEventId,
            status: error.code,
            reason: error.message,
          });
        }
        throw error;
      }

      const recipients = mergeRecipients(parsed, notification.recipients);
      const routeDecisions =
        await receivingRouteService.matchRecipients(recipients);
      const routeTenant = resolveSingleTenant(routeDecisions);
      const candidateUserId = resolveSingleCandidateTenant(routeDecisions);
      const replyMatch = candidateUserId
        ? await resolveInboundReply({
            userId: candidateUserId,
            recipients,
            headers: parsed.headers,
            from: parsed.from,
          })
        : null;
      const hasReplyTokenCandidate = candidateUserId
        ? hasInboundReplyTokenCandidate({
            recipients,
            headers: parsed.headers,
          })
        : false;
      const tenant =
        replyMatch?.status === "matched"
          ? { userId: replyMatch.userId, routeable: [] }
          : (routeTenant ??
            (candidateUserId && hasReplyTokenCandidate
              ? { userId: candidateUserId, routeable: [] }
              : null));
      if (!tenant) {
        return await markTerminal({
          eventId: created.event.id,
          providerEventId,
          status: "missing_domain",
          reason: terminalReasonForRouting(routeDecisions),
          userId: routeDecisions.find((decision) => decision.userId)?.userId,
        });
      }

      const receivedEmailId = randomUUID();
      const storedAttachments: StoredAttachment[] = [];
      const uploadedKeys: string[] = [];

      try {
        for (const attachment of parsed.attachments) {
          const key = attachmentObjectKey({
            receivedEmailId,
            attachmentId: attachment.id,
            filename: attachment.filename,
            content: attachment.content,
          });
          await uploadFile(key, attachment.content, attachment.contentType);
          uploadedKeys.push(key);
          storedAttachments.push({
            id: attachment.id,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size,
            s3Key: key,
          });
        }
      } catch (error) {
        await cleanupStoredAttachments(uploadedKeys, deleteFile);
        return await markTerminal({
          eventId: created.event.id,
          providerEventId,
          status: "storage_failure",
          reason:
            error instanceof Error
              ? error.message
              : "Attachment storage failed",
          userId: tenant.userId,
        });
      }

      try {
        const result = await db.transaction(async (tx) => {
          const [received] = await tx
            .insert(receivedEmails)
            .values({
              id: receivedEmailId,
              from: parsed.from,
              to: recipients,
              subject: parsed.subject,
              html: parsed.html,
              text: parsed.text,
              status: "received",
              routeDecisions: routeDecisions.map(
                ({ userId: _userId, ...decision }) => decision,
              ),
              attachments: storedAttachments,
              headers: parsed.headers,
              replyMatchStatus: replyMatch?.status ?? "unmatched",
              threadId:
                replyMatch?.status === "matched" ? replyMatch.threadId : null,
              replyToEmailId:
                replyMatch?.status === "matched" ? replyMatch.emailId : null,
              contactId:
                replyMatch?.status === "matched" ? replyMatch.contactId : null,
              userId: tenant.userId,
            })
            .returning();

          const [event] = await tx
            .insert(emailEvents)
            .values({
              emailId: null,
              sourceId: `inbound:${provider}:${providerEventId}`,
              type: "received",
              userId: tenant.userId,
              payload: {
                received_email_id: received.id,
                provider,
                provider_event_id: providerEventId,
                provider_message_id: notification.messageId ?? parsed.messageId,
                message_id: parsed.messageId,
                reply_match_status: replyMatch?.status ?? "unmatched",
                reply_to_email_id:
                  replyMatch?.status === "matched" ? replyMatch.emailId : null,
                thread_id:
                  replyMatch?.status === "matched" ? replyMatch.threadId : null,
                recipients,
                attachment_count: storedAttachments.length,
                size: parsed.size,
                content_hash: parsed.contentHash,
              },
            })
            .returning();

          return { received, event };
        });

        await inboundProviderEventRepo.markProcessed({
          id: created.event.id,
          userId: tenant.userId,
          receivedEmailId: result.received.id,
        });

        try {
          await forwardingRuleService.processReceivedEmail({
            receivedEmail: result.received,
          });
        } catch (error) {
          console.error(
            "Inbound forwarding failed after received email commit:",
            {
              receivedEmailId: result.received.id,
              error,
            },
          );
        }

        return {
          status: "processed",
          provider_event_id: providerEventId,
          received_email_id: result.received.id,
          event_id: result.event.id,
          user_id: tenant.userId,
          attachments: storedAttachments.length,
        };
      } catch (error) {
        await cleanupStoredAttachments(uploadedKeys, deleteFile);
        return await markTerminal({
          eventId: created.event.id,
          providerEventId,
          status: "storage_failure",
          reason:
            error instanceof Error
              ? `Database commit failed after storage: ${error.message}`
              : "Database commit failed after storage",
          userId: tenant.userId,
        });
      }
    },
  };
}

export const inboundEmailIngestionService =
  createInboundEmailIngestionService();
