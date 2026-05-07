# opensend

TypeScript SDK for the OpenSend email API with a Resend-compatible client surface.

## Installation

```bash
bun add opensend
```

## Getting Started

Use the Resend-compatible export for the easiest migration path:

```typescript
import { Resend } from "opensend";

const resend = new Resend("re_your_api_key");
```

By default the SDK targets OpenSend's hosted API origin, `https://api.opensend.com`.
Self-hosted deployments can override the origin with `baseUrl`:

```typescript
import { Resend } from "opensend";

const resend = new Resend("re_your_api_key", {
  baseUrl: "https://api.your-deployment.example.com",
});
```

The existing `Opensend` export is still supported for backwards compatibility:

```typescript
import { Opensend } from "opensend";

const client = new Opensend("re_your_api_key", {
  baseUrl: "https://api.your-deployment.example.com",
});
```

## Sending Emails

```typescript
const { data, error } = await resend.emails.send({
  from: "hello@updates.example.com",
  to: "user@example.com",
  subject: "Welcome!",
  html: "<h1>Welcome aboard</h1>",
});

if (error) {
  console.error(error.message);
} else {
  console.log("Queued:", data.id);
}
```

`resend.emails.send()` posts to the Resend-compatible `/emails` endpoint and
returns after the API persists the row and queues background delivery work. Poll
`resend.emails.get(id)` or list emails to observe the lifecycle: `queued` →
`processing` → `sent`, followed by SES delivery events such as `delivered`,
`bounced`, `opened`, or `clicked`. The `created_at` timestamp is queue time;
`sent_at` is set by the worker after SES accepts the message.

### With React components

```tsx
const { data } = await resend.emails.send({
  from: "hello@updates.example.com",
  to: "user@example.com",
  subject: "Invoice",
  react: <InvoiceEmail amount={49.99} />,
});
```

## Batch Sending

```typescript
const { data, error } = await resend.emails.sendBatch([
  {
    from: "hello@updates.example.com",
    to: "a@example.com",
    subject: "Hi A",
    html: "<p>A</p>",
  },
  {
    from: "hello@updates.example.com",
    to: "b@example.com",
    subject: "Hi B",
    html: "<p>B</p>",
  },
]);
```

`resend.emails.sendBatch()` posts to the Resend-compatible `/emails/batch`
endpoint.

## Scheduled Sends

Pass `scheduled_at` as a string to defer delivery for `send` or `sendBatch`.
The API reschedule endpoint accepts the same formats. Supported values are
future ISO 8601 date-times with a timezone (for example `2026-05-08T00:00:00.000Z`) or the small
Resend-compatible natural-language form `in <positive integer>
<minute|min|minutes|hour|hours|day|days>` such as `in 1 min`. Values must be
within 30 days; unparseable, past, or out-of-policy values return
`validation_error`.

## Idempotency Keys

Pass a per-request `idempotencyKey` option to prevent accidental duplicate
acceptance when retrying sends. Keys must match the API contract: 1-255
characters. OpenSend preserves the existing send contract for duplicate keys: the
API returns `409 idempotency_conflict` with the originally accepted email id in
`details.id`; batch duplicates are rejected before reserving quota, creating
additional rows, or publishing more queue jobs.

```typescript
await resend.emails.send(
  {
    from: "hello@updates.example.com",
    to: "user@example.com",
    subject: "Welcome!",
    html: "<h1>Welcome aboard</h1>",
  },
  { idempotencyKey: "welcome-user-123" },
);

await resend.emails.sendBatch(
  [
    {
      from: "hello@updates.example.com",
      to: "a@example.com",
      subject: "Hi A",
      html: "<p>A</p>",
    },
    {
      from: "hello@updates.example.com",
      to: "b@example.com",
      subject: "Hi B",
      html: "<p>B</p>",
    },
  ],
  { idempotencyKey: "batch-campaign-123" },
);
```

## Listing Emails

```typescript
const { data } = await resend.emails.list();
console.log(data.data); // EmailListItem[]

const queued = await resend.emails.list({ status: "queued" });
```

## Getting an Email

```typescript
const { data } = await resend.emails.get("email-id");
```

## Domains

```typescript
// Create a domain
await resend.domains.create({ name: "example.com" });

// List domains
const { data } = await resend.domains.list();

// Get a domain
await resend.domains.get("domain-id");

// Verify a domain
await resend.domains.verify("domain-id");
```

## API Keys

```typescript
// Create an API key
const { data } = await resend.apiKeys.create({ name: "Production Key" });
console.log(data.token); // Only shown once

// List API keys
await resend.apiKeys.list();

// Delete an API key
await resend.apiKeys.delete("key-id");
```

## Contacts

```typescript
// Create a contact
await resend.contacts.create({ email: "user@example.com" });

// List contacts
const { data } = await resend.contacts.list();

// Get a contact
await resend.contacts.get("contact-id");

// Update a contact by id or email
await resend.contacts.update("user@example.com", { unsubscribed: true });

// Delete a contact by id or email
await resend.contacts.delete("user@example.com");
```

## TypeScript

Public request, response, and error shapes are exported from the package
entrypoint:

```typescript
import type {
  ApiError,
  ApiResponse,
  BatchEmailResponse,
  EmailOptions,
  EmailResponse,
  RequestOptions,
  SendEmailPayload,
  SDKOptions,
} from "opensend";
```

## Error Handling

All methods return `{ data, error }`. Check `error` before using `data`:

```typescript
const { data, error } = await resend.emails.send({ ... });

if (error) {
  console.error(`Error ${error.statusCode}: ${error.message}`);
  return;
}

// data is guaranteed non-null here
console.log(data.id);
```

## Configuration

`new Resend(apiKey, options?)` accepts an optional `baseUrl`. Use this for
self-hosted OpenSend deployments:

```typescript
const resend = new Resend("re_your_api_key", {
  baseUrl: "https://api.your-deployment.example.com",
});
```
