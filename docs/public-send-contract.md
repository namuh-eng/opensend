# Public send email contract boundary

The contract-stable boundary for the adopted send route family lives in
`packages/core/src/contracts/`:

- `send.ts` owns public `POST /emails`, `POST /api/emails`,
  `POST /emails/batch`, and `POST /api/emails/batch` request validation,
  recipient normalization helpers, and success response schemas.
- `public-api-errors.ts` owns the public JSON error envelope used by the send
  route family: `name`, `code`, `message`, `statusCode`, and optional sanitized
  `details`.

These modules may be imported by Next route handlers, `services/api`, tests,
SDK compatibility checks, and documentation code. They must not import Next.js
app internals, route handlers, database clients, SES/SQS clients, or dashboard
components.

## Contract-stable

- Request field names and casing for send payloads: `from`, `to`, `cc`, `bcc`,
  `reply_to`, `subject`, `html`, `text`, `headers`, `attachments`, `tags`,
  `scheduled_at`, `topic_id`, and `template`.
- Recipient input accepts either a string email address or an array of email
  addresses. Runtime handlers normalize accepted recipients to arrays before
  persistence or suppression checks.
- Batch send accepts an array of send payloads with a maximum of 100 items.
- Single-send success response is `{ id: string }`.
- Batch-send success response is `{ data: Array<{ id: string } | { error:
  PublicApiErrorEnvelope }> }`.
- Public error envelopes include `name`, `code`, `message`, `statusCode`, and
  optional sanitized `details`.
- Validation details expose only `formErrors` and `fieldErrors`.

## App-internal

- Next.js route files and middleware rewrites.
- Hono service adapter plumbing in `services/api`.
- API-key lookup, permission checks, quota reservation, suppression checks,
  template rendering, unsubscribe header injection, database rows, telemetry,
  queue publishing, and audit logging.
- Storage-specific normalization for attachments after request validation.
- Public docs/OpenAPI rendering code; it should reference the same contract
  shapes but is not the source of truth.

When changing send or batch send behavior, update the contract module and its
focused contract tests first, then adapt app/service handlers and SDK/docs tests
to that boundary.
