# Send Test Emails

Use OpenSend sandbox recipients when you need predictable delivery outcomes without sending to a real mailbox. Test recipients are useful for integration tests, staging queues, webhook handlers, and dashboard lifecycle checks.

## Supported sandbox recipients

OpenSend recognizes the following recipient patterns at `resend.dev`:

| Recipient | Outcome |
| --- | --- |
| `delivered@resend.dev` | Accepted as a delivered sandbox send. |
| `bounced@resend.dev` | Produces a bounce-style sandbox outcome. |
| `complained@resend.dev` | Produces a complaint-style sandbox outcome. |
| `suppressed@resend.dev` | Fails at accept time with `recipient_suppressed`. |
| `delivered+label@resend.dev` | Delivered outcome with a label in the local part. |
| `bounced+label@resend.dev` | Bounced outcome with a label in the local part. |
| `complained+label@resend.dev` | Complaint outcome with a label in the local part. |

`delivered`, `bounced`, `complained`, and `suppressed` are the supported unlabeled outcomes. Labeled test addresses support `delivered`, `bounced`, and `complained`.

## Example request

```bash
curl -X POST https://opensend.namuh.co/emails \
  -H "Authorization: Bearer os_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "Acme <onboarding@example.com>",
    "to": "delivered+signup@resend.dev",
    "subject": "Sandbox delivery test",
    "html": "<p>This verifies the OpenSend accept path and worker pipeline.</p>"
  }'
```

A successful response still returns an email ID. Inspect that ID in **Emails** or with `GET /emails/{id}/trace` to confirm the lifecycle evidence your app expects.

## Mixing rules

A single email cannot mix sandbox recipients with real recipients. It also cannot mix different sandbox outcomes in `to`, `cc`, and `bcc`. Use separate requests or separate batch items for each outcome.

For example, this is invalid because one message contains two outcomes:

```json
{
  "to": ["delivered@resend.dev", "bounced@resend.dev"],
  "subject": "invalid mixed test",
  "html": "<p>Split these into separate messages.</p>"
}
```

## What test sends prove

Sandbox sends prove OpenSend request validation, authentication, quota checks, idempotency handling, row creation, lifecycle event handling, dashboard rendering, and webhook consumers for the chosen outcome.

They do not prove DNS authentication, mailbox placement, real-provider throttling, or recipient-specific deliverability. For those checks, use a verified sending domain and a real test inbox you control.
