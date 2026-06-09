# Idempotency Keys

Idempotency keys prevent duplicate accepted sends when application code retries after a timeout, crash, or provider webhook replay. OpenSend supports idempotency for single email sends, batch sends, broadcast creation/sending, and selected write APIs.

## When to use them

Use an idempotency key for any operation where duplicate mail would be harmful:

- signup and invite emails
- receipts and invoices
- checkout or payment lifecycle messages
- queue jobs that retry automatically
- webhook-triggered sends

## Key design

Keys should be deterministic for the business event, for example `receipt-order_123` or `invite-user_456-workspace_789`. Do not use a random UUID if the retry cannot reproduce it.

OpenSend keeps idempotency decisions for a bounded window. After expiry, reusing the same key can create a new operation.
