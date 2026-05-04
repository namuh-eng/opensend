# @opensend/sdk

TypeScript SDK for the OpenSend email API.

## Installation

```bash
bun add @opensend/sdk
```

## Getting Started

```typescript
import { OpenSend } from "@opensend/sdk";

const client = new OpenSend("re_your_api_key", {
  baseUrl: "https://your-deployment.example.com",
});
```

## Sending Emails

```typescript
const { data, error } = await client.emails.send({
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

`client.emails.send()` returns after the API persists the row and queues
background delivery work. Poll `client.emails.get(id)` or list emails to observe
the lifecycle: `queued` → `processing` → `sent`, followed by SES delivery events
such as `delivered`, `bounced`, `opened`, or `clicked`. The `created_at`
timestamp is queue time; `sent_at` is set by the worker after SES accepts the
message.

### With React components

```tsx
const { data } = await client.emails.send({
  from: "hello@updates.example.com",
  to: "user@example.com",
  subject: "Invoice",
  react: <InvoiceEmail amount={49.99} />,
});
```

## Idempotency Keys

Pass a per-request `idempotencyKey` option to prevent accidental duplicate
acceptance when retrying sends. Keys must match the API contract: 1-255
characters. OpenSend preserves the existing send contract for duplicate keys: the
API returns `409 idempotency_conflict` with the originally accepted email id in
`details.id`; batch duplicates are rejected before reserving quota, creating
additional rows, or publishing more queue jobs.

```typescript
await client.emails.send(
  {
    from: "hello@updates.example.com",
    to: "user@example.com",
    subject: "Welcome!",
    html: "<h1>Welcome aboard</h1>",
  },
  { idempotencyKey: "welcome-user-123" },
);

await client.emails.sendBatch(
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
const { data } = await client.emails.list();
console.log(data.data); // EmailListItem[]

const queued = await client.emails.list({ status: "queued" });
```

## Getting an Email

```typescript
const { data } = await client.emails.get("email-id");
```

## Domains

```typescript
// Create a domain
await client.domains.create({ name: "example.com" });

// List domains
const { data } = await client.domains.list();

// Get a domain
await client.domains.get("domain-id");

// Verify a domain
await client.domains.verify("domain-id");
```

## API Keys

```typescript
// Create an API key
const { data } = await client.apiKeys.create({ name: "Production Key" });
console.log(data.token); // Only shown once

// List API keys
await client.apiKeys.list();

// Delete an API key
await client.apiKeys.delete("key-id");
```

## Contacts

```typescript
// Create a contact
await client.contacts.create({ email: "user@example.com" });

// List contacts
const { data } = await client.contacts.list();

// Get a contact
await client.contacts.get("contact-id");
```

## Error Handling

All methods return `{ data, error }`. Check `error` before using `data`:

```typescript
const { data, error } = await client.emails.send({ ... });

if (error) {
  console.error(`Error ${error.statusCode}: ${error.message}`);
  return;
}

// data is guaranteed non-null here
console.log(data.id);
```

## Configuration

The SDK is publish-ready and does not assume a local dev server. Pass your
deployment origin explicitly:

```typescript
const client = new OpenSend("re_your_api_key", {
  baseUrl: "https://api.your-deployment.example.com",
});
```
