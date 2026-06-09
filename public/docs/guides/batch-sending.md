# Batch Sending

Use batch sending when your application needs to accept several transactional messages in one API call while keeping each message as its own email record, status, webhook stream, and dashboard detail page.

`POST /emails/batch` accepts an array of send payloads and queues up to 100 emails per request.

## When to use it

Use batch sending for:

- Queueing a small group of transactional emails after one application event.
- Retrying a queue drain with one request and one `Idempotency-Key`.
- Sending independent messages that share deployment timing but not content.

Use broadcasts instead when you need segment targeting, campaign authoring, campaign metrics, or topic-driven marketing sends.

## Request shape

Each array item uses the same fields as `POST /emails`: `from`, `to`, `subject`, `html`, `text`, `cc`, `bcc`, `reply_to`, `headers`, `attachments`, `tags`, `scheduled_at`, `topic_id`, or `template`.

```bash
curl -X POST https://opensend.namuh.co/emails/batch \
  -H "Authorization: Bearer os_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: invoice-run-2026-06-08" \
  -d '[
    {
      "from": "Acme Billing <billing@example.com>",
      "to": "ada@example.com",
      "subject": "Receipt for invoice INV-1001",
      "html": "<p>Thanks for your payment.</p>",
      "tags": [{ "name": "workflow", "value": "invoice" }]
    },
    {
      "from": "Acme Billing <billing@example.com>",
      "to": "grace@example.com",
      "subject": "Receipt for invoice INV-1002",
      "text": "Thanks for your payment.",
      "tags": [{ "name": "workflow", "value": "invoice" }]
    }
  ]'
```

A successful response returns one result per submitted item:

```json
{
  "data": [
    { "id": "email_1" },
    { "id": "email_2" }
  ]
}
```

## Partial item errors

Suppressed recipients are reported per item. OpenSend can accept the other valid items and return an item-level `error` for the suppressed one:

```json
{
  "data": [
    { "id": "email_1" },
    {
      "error": {
        "name": "recipient_suppressed",
        "code": "recipient_suppressed",
        "message": "Recipient ada@example.com is suppressed because it bounced. Remove the suppression before sending again.",
        "statusCode": 422
      }
    }
  ]
}
```

Validation errors that apply to the whole request, invalid authentication, sending-domain restrictions, or quota failures fail the request before rows are inserted.

## Idempotency

Include an `Idempotency-Key` when your application may retry a batch after a timeout. OpenSend stores the batch replay response on the first accepted email row, then replays the same response for matching retries in the idempotency window.

Keep the key stable for the logical batch, not for each item. If one item changes, use a new key.

## Scheduling and webhooks

Each accepted item becomes its own email row. Items with `scheduled_at` are stored as scheduled messages and emit `email.scheduled`. Items without `scheduled_at` are queued for the worker immediately.

Lifecycle webhooks and dashboard status updates are per email, not per batch request. Use the returned IDs to inspect details with `GET /emails/{id}` or `GET /emails/{id}/trace`.

## Limits and caveats

- Maximum request size: 100 email payloads.
- Attachments are still limited to 40 MB per email after Base64 encoding.
- Batch sends share the batch rate-limit bucket, which is stricter than ordinary read routes.
- Sandbox test recipients cannot be mixed with real recipients or different sandbox outcomes in the same email item. Put each sandbox outcome in its own item.
