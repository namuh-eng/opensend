import type { SendEmailRequest } from "@/lib/validation/emails";

export type RequestAttachment = NonNullable<
  SendEmailRequest["attachments"]
>[number];

export type StoredEmailAttachment = {
  id: string;
  filename: string;
  content?: string;
  path?: string;
  content_type?: string;
  content_id?: string;
};

export function normalizeAttachmentsForSend(
  attachments: SendEmailRequest["attachments"],
):
  | Array<{
      filename: string;
      content: string;
      content_type?: string;
      content_id?: string;
    }>
  | undefined {
  const sendableAttachments = attachments
    ?.filter(
      (attachment): attachment is RequestAttachment & { content: string } =>
        typeof attachment.content === "string",
    )
    .map(({ filename, content, content_type, content_id }) => ({
      filename,
      content,
      content_type,
      content_id,
    }));

  return sendableAttachments && sendableAttachments.length > 0
    ? sendableAttachments
    : undefined;
}

export function normalizeAttachmentsForStorage(
  attachments: SendEmailRequest["attachments"],
): StoredEmailAttachment[] {
  return (
    attachments?.map((attachment) => ({
      id: crypto.randomUUID(),
      filename: attachment.filename,
      content: attachment.content,
      path: attachment.path,
      content_type: attachment.content_type,
      content_id: attachment.content_id,
    })) ?? []
  );
}
