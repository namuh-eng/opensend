import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { emailEvents, emails } from "../db/schema";
import { storageService } from "./storage";

type EmailRow = typeof emails.$inferSelect;
type EmailEventRow = typeof emailEvents.$inferSelect;

export type EmailLifecycleAttachmentRow = {
  id?: string;
  filename: string;
  content_type?: string;
  contentType?: string;
  s3Key?: string;
  path?: string;
};

type EmailLifecycleEmailRow = Pick<EmailRow, "id" | "status" | "attachments">;

type EmailLifecycleStatusRow = Pick<EmailRow, "id" | "status">;

export type EmailLifecycleAttachmentListItem = {
  id: string;
  filename: string;
  content_type: string;
};

export type EmailLifecycleAttachmentListResponse = {
  object: "list";
  data: EmailLifecycleAttachmentListItem[];
};

export type EmailLifecycleAttachmentDetailResponse = {
  object: "attachment";
  id: string;
  filename: string;
  content_type: string;
  download_url: string;
  expires_at: string;
};

export type EmailLifecycleCancelResponse = {
  object: "email";
  id: string;
  status: "canceled";
};

export type EmailLifecycleEventListItem = {
  object: "email_event";
  id: string;
  type: string;
  payload: unknown;
  created_at: EmailEventRow["receivedAt"];
};

export type EmailLifecycleEventListResponse = {
  object: "list";
  data: EmailLifecycleEventListItem[];
};

export type EmailLifecycleRepository = {
  findEmailForUser(
    id: string,
    userId: string,
  ): Promise<EmailLifecycleEmailRow | undefined>;
  updateEmailStatusForUser(
    id: string,
    userId: string,
    status: string,
  ): Promise<EmailLifecycleStatusRow | undefined>;
  listEventsByEmailIdAsc(emailId: string): Promise<EmailEventRow[]>;
};

export type EmailLifecycleServiceErrorCode =
  | "email_not_found"
  | "attachment_not_found"
  | "invalid_state";

export class EmailLifecycleServiceError extends Error {
  constructor(
    readonly code: EmailLifecycleServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EmailLifecycleServiceError";
  }
}

export type EmailLifecycleServiceDependencies = {
  repository?: EmailLifecycleRepository;
  getPresignedUrl?: (key: string) => Promise<string>;
  now?: () => Date;
};

const defaultRepository: EmailLifecycleRepository = {
  async findEmailForUser(id, userId) {
    return await db.query.emails.findFirst({
      where: and(eq(emails.id, id), eq(emails.userId, userId)),
    });
  },

  async updateEmailStatusForUser(id, userId, status) {
    const [updated] = await db
      .update(emails)
      .set({ status })
      .where(and(eq(emails.id, id), eq(emails.userId, userId)))
      .returning({ id: emails.id, status: emails.status });

    return updated;
  },

  async listEventsByEmailIdAsc(emailId) {
    return await db
      .select()
      .from(emailEvents)
      .where(eq(emailEvents.emailId, emailId))
      .orderBy(asc(emailEvents.receivedAt));
  },
};

function attachmentId(attachment: EmailLifecycleAttachmentRow, index: number) {
  return attachment.id || `att-${index}`;
}

function getAttachments(email: EmailLifecycleEmailRow) {
  return (email.attachments ?? []) as EmailLifecycleAttachmentRow[];
}

function requireEmail(email: EmailLifecycleEmailRow | undefined) {
  if (!email) {
    throw new EmailLifecycleServiceError("email_not_found", "Email not found");
  }

  return email;
}

function toAttachmentListItem(
  attachment: EmailLifecycleAttachmentRow,
  index: number,
): EmailLifecycleAttachmentListItem {
  return {
    id: attachmentId(attachment, index),
    filename: attachment.filename,
    content_type: attachment.content_type || "application/octet-stream",
  };
}

function toEmailEventListItem(
  event: EmailEventRow,
): EmailLifecycleEventListItem {
  return {
    object: "email_event",
    id: event.id,
    type: event.type,
    payload: event.payload,
    created_at: event.receivedAt,
  };
}

export function createEmailLifecycleService({
  repository = defaultRepository,
  getPresignedUrl = storageService.getPresignedUrl.bind(storageService),
  now = () => new Date(),
}: EmailLifecycleServiceDependencies = {}) {
  return {
    async listAttachments(
      userId: string,
      emailId: string,
    ): Promise<EmailLifecycleAttachmentListResponse> {
      const email = requireEmail(
        await repository.findEmailForUser(emailId, userId),
      );

      return {
        object: "list",
        data: getAttachments(email).map(toAttachmentListItem),
      };
    },

    async getAttachment(
      userId: string,
      emailId: string,
      requestedAttachmentId: string,
    ): Promise<EmailLifecycleAttachmentDetailResponse> {
      const email = requireEmail(
        await repository.findEmailForUser(emailId, userId),
      );
      const attachment = getAttachments(email).find(
        (candidate, index) =>
          attachmentId(candidate, index) === requestedAttachmentId,
      );

      if (!attachment) {
        throw new EmailLifecycleServiceError(
          "attachment_not_found",
          "Attachment not found",
        );
      }

      const s3Key =
        attachment.s3Key ||
        attachment.path ||
        `sent-emails/${emailId}/${attachment.filename}`;
      const downloadUrl = await getPresignedUrl(s3Key);

      return {
        object: "attachment",
        id: attachment.id || requestedAttachmentId,
        filename: attachment.filename,
        content_type: attachment.contentType || "application/octet-stream",
        download_url: downloadUrl,
        expires_at: new Date(now().getTime() + 3600 * 1000).toISOString(),
      };
    },

    async cancelEmail(
      userId: string,
      emailId: string,
    ): Promise<EmailLifecycleCancelResponse> {
      const existing = requireEmail(
        await repository.findEmailForUser(emailId, userId),
      );

      if (existing.status !== "scheduled") {
        throw new EmailLifecycleServiceError(
          "invalid_state",
          `Cannot cancel a ${existing.status} email`,
        );
      }

      const updated = await repository.updateEmailStatusForUser(
        emailId,
        userId,
        "canceled",
      );

      if (!updated) {
        throw new Error("Email status update returned no row");
      }

      return {
        object: "email",
        id: updated.id,
        status: "canceled",
      };
    },

    async listEvents(
      userId: string,
      emailId: string,
    ): Promise<EmailLifecycleEventListResponse> {
      requireEmail(await repository.findEmailForUser(emailId, userId));
      const events = await repository.listEventsByEmailIdAsc(emailId);

      return {
        object: "list",
        data: events.map(toEmailEventListItem),
      };
    },
  };
}

export const emailLifecycleService = createEmailLifecycleService();
