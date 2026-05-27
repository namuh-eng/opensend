# Dashboard Emails

The Emails area is the operational view for transactional and scheduled messages. Use it to inspect queued, processing, sent, delivered, bounced, complained, opened, and clicked lifecycle states after the API or SDK accepts a message.

OpenSend separates acceptance from delivery. A successful `/emails` API response means the row was created and queued. Worker and SES events update the message later. In self-hosted deployments, verify the background worker/ingester is running before treating a stuck `queued` state as a provider failure.

## What you can do

- Search and filter sent email records.
- Open an email detail page for subject, recipients, timestamps, and status.
- Review associated logs and delivery events.
- Check whether the primary recipient is suppressed.
- Use API reference pages when you need exact JSON schemas.

## Related docs

- [Attachments](./attachments.md)
- [Custom headers](./custom-headers.md)
- [Idempotency keys](./idempotency-keys.md)
- [Schedule email](./schedule-email.md)
- [Tags](./tags.md)
- [Email suppressions](./email-suppressions.md)
- [Email bounces](./email-bounces.md)
