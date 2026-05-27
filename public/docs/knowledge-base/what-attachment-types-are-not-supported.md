# What attachment types are not supported?

OpenSend accepts attachments through the email API and SMTP relay, but operators should restrict unsafe or oversized files according to their security policy and provider limits.

## Practical limits

- Keep total encoded attachment size under the configured send limit.
- Avoid executable formats such as `.exe`, `.scr`, `.bat`, `.cmd`, and macro-enabled Office files unless your business explicitly requires them.
- Prefer PDFs, images, CSV exports, and plain documents for routine customer mail.
- Use links to authenticated downloads for large or sensitive files.

## Security guidance

Attachments can trigger mailbox-provider filtering even when the message is legitimate. If deliverability drops after adding attachments, test without them, check file type/size, and consider using a secure link instead.
