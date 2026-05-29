import { receivedEmailRepo } from "../db/repositories/receivedEmailRepo";
import type { receivedEmails } from "../db/schema";
import {
  type ThreadSummary,
  getThreadForReceivedEmail,
} from "./replyThreading";
import { storageService } from "./storage";

type ReceivedEmailRow = typeof receivedEmails.$inferSelect;

type ReceivedEmailListRow = Pick<
  ReceivedEmailRow,
  | "id"
  | "from"
  | "to"
  | "subject"
  | "routeDecisions"
  | "replyMatchStatus"
  | "threadId"
  | "replyToEmailId"
  | "contactId"
  | "createdAt"
>;

type ReceivedEmailAttachmentRow = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  s3Key: string;
};

type ReceivedEmailAttachmentContainer = {
  attachments: ReceivedEmailRow["attachments"];
};

export type ReceivedEmailRouteDecision = NonNullable<
  ReceivedEmailRow["routeDecisions"]
>[number];

export type ReceivedEmailListItem = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  route_decisions: ReceivedEmailRouteDecision[];
  reply_match_status: string;
  thread_id: string | null;
  reply_to_email_id: string | null;
  contact_id: string | null;
  created_at: Date;
};

export type ReceivedEmailListResponse = {
  object: "list";
  data: ReceivedEmailListItem[];
  has_more: boolean;
};

export type ReceivedEmailDetailResponse = {
  object: "received_email";
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string | null;
  text: string | null;
  route_decisions: ReceivedEmailRouteDecision[];
  reply_match_status: string;
  thread_id: string | null;
  reply_to_email_id: string | null;
  contact_id: string | null;
  thread: ThreadSummary;
  created_at: Date;
};

export type ReceivedEmailAttachmentListItem = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
};

export type ReceivedEmailAttachmentListResponse = {
  object: "list";
  data: ReceivedEmailAttachmentListItem[];
};

export type ReceivedEmailAttachmentDetailResponse = {
  object: "received_email_attachment";
  id: string;
  filename: string;
  content_type: string;
  size: number;
  download_url: string;
  expires_at: string;
};

export type ReceivedEmailRepository = {
  listForApi(options: {
    userId: string;
    limit: number;
    after?: string;
    to?: string;
  }): Promise<{ data: ReceivedEmailListRow[]; hasMore: boolean }>;
  findById(id: string, userId: string): Promise<ReceivedEmailRow | undefined>;
  findAttachmentsByEmailId(
    id: string,
    userId: string,
  ): Promise<ReceivedEmailAttachmentContainer | undefined>;
};

export type ReceivedEmailServiceErrorCode =
  | "received_email_not_found"
  | "attachment_not_found";

export class ReceivedEmailServiceError extends Error {
  constructor(
    readonly code: ReceivedEmailServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReceivedEmailServiceError";
  }
}

export type ReceivedEmailServiceDependencies = {
  repository?: ReceivedEmailRepository;
  getPresignedUrl?: (key: string) => Promise<string>;
  getThread?: typeof getThreadForReceivedEmail;
  now?: () => Date;
};

export type ListReceivedEmailsInput = {
  userId: string;
  limit?: number;
  after?: string;
  to?: string | null;
};

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit) || limit === 0) {
    return 20;
  }

  return Math.min(Math.max(limit, 1), 100);
}

function normalizeToFilter(to: string | null | undefined): string | undefined {
  const normalized = to?.trim().toLowerCase();
  return normalized || undefined;
}

function normalizeAfter(after: string | undefined): string | undefined {
  return after || undefined;
}

function toListItem(row: ReceivedEmailListRow): ReceivedEmailListItem {
  return {
    id: row.id,
    from: row.from,
    to: row.to,
    subject: row.subject,
    route_decisions: row.routeDecisions ?? [],
    reply_match_status: row.replyMatchStatus,
    thread_id: row.threadId,
    reply_to_email_id: row.replyToEmailId,
    contact_id: row.contactId,
    created_at: row.createdAt,
  };
}

function unmatchedReceivedThread(row: ReceivedEmailRow): ThreadSummary {
  return {
    thread_id: null,
    match_status: "unmatched",
    original_email_id: null,
    contact_id: null,
    messages: [
      {
        id: row.id,
        direction: "inbound",
        subject: row.subject,
        from: row.from,
        to: row.to,
        text: row.text,
        html: row.html,
        created_at: row.createdAt,
      },
    ],
  };
}

async function toDetail(
  row: ReceivedEmailRow,
  userId: string,
  getThread: typeof getThreadForReceivedEmail,
): Promise<ReceivedEmailDetailResponse> {
  const thread = row.threadId
    ? await getThread({
        userId,
        receivedEmailId: row.id,
      })
    : unmatchedReceivedThread(row);

  return {
    object: "received_email",
    id: row.id,
    from: row.from,
    to: row.to,
    subject: row.subject,
    html: row.html,
    text: row.text,
    route_decisions: row.routeDecisions ?? [],
    reply_match_status: row.replyMatchStatus,
    thread_id: row.threadId,
    reply_to_email_id: row.replyToEmailId,
    contact_id: row.contactId,
    thread,
    created_at: row.createdAt,
  };
}

function getAttachments(
  email: ReceivedEmailAttachmentContainer,
): ReceivedEmailAttachmentRow[] {
  return (email.attachments ?? []) as ReceivedEmailAttachmentRow[];
}

function toAttachmentListItem(
  attachment: ReceivedEmailAttachmentRow,
): ReceivedEmailAttachmentListItem {
  return {
    id: attachment.id,
    filename: attachment.filename,
    content_type: attachment.contentType,
    size: attachment.size,
  };
}

function requireEmail<T>(email: T | undefined): T {
  if (!email) {
    throw new ReceivedEmailServiceError(
      "received_email_not_found",
      "Received email not found",
    );
  }

  return email;
}

export function createReceivedEmailService({
  repository = receivedEmailRepo,
  getPresignedUrl = storageService.getPresignedUrl.bind(storageService),
  getThread = getThreadForReceivedEmail,
  now = () => new Date(),
}: ReceivedEmailServiceDependencies = {}) {
  return {
    async listReceivedEmails(
      input: ListReceivedEmailsInput,
    ): Promise<ReceivedEmailListResponse> {
      const result = await repository.listForApi({
        userId: input.userId,
        limit: normalizeLimit(input.limit),
        after: normalizeAfter(input.after),
        to: normalizeToFilter(input.to),
      });

      return {
        object: "list",
        data: result.data.map(toListItem),
        has_more: result.hasMore,
      };
    },

    async getReceivedEmail(
      id: string,
      userId: string,
    ): Promise<ReceivedEmailDetailResponse> {
      return await toDetail(
        requireEmail(await repository.findById(id, userId)),
        userId,
        getThread,
      );
    },

    async listAttachments(
      emailId: string,
      userId: string,
    ): Promise<ReceivedEmailAttachmentListResponse> {
      const email = requireEmail(
        await repository.findAttachmentsByEmailId(emailId, userId),
      );

      return {
        object: "list",
        data: getAttachments(email).map(toAttachmentListItem),
      };
    },

    async getAttachment(
      emailId: string,
      attachmentId: string,
      userId: string,
    ): Promise<ReceivedEmailAttachmentDetailResponse> {
      const email = requireEmail(
        await repository.findAttachmentsByEmailId(emailId, userId),
      );
      const attachment = getAttachments(email).find(
        (candidate) => candidate.id === attachmentId,
      );

      if (!attachment) {
        throw new ReceivedEmailServiceError(
          "attachment_not_found",
          "Attachment not found",
        );
      }

      return {
        object: "received_email_attachment",
        id: attachment.id,
        filename: attachment.filename,
        content_type: attachment.contentType,
        size: attachment.size,
        download_url: await getPresignedUrl(attachment.s3Key),
        expires_at: new Date(now().getTime() + 3600 * 1000).toISOString(),
      };
    },
  };
}

export const receivedEmailService = createReceivedEmailService();
