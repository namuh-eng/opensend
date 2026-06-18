# List Email Trace

List the chronological trace for one sent email.

`GET /emails/{id}/trace`

Compatibility note: `GET /api/emails/{id}/trace` remains available for existing OpenSend integrations; new API clients should prefer the root compatibility path above.

## Authentication

Use an OpenSend API key with full access in the Authorization header.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Response

The response is tenant-scoped and ordered from oldest to newest. Trace entries can include:

- `request` evidence from sanitized API request logs linked by `emailId` or `emailIds` metadata.
- `queue` state such as creation, scheduled delivery time, and worker handoff time.
- `provider` lifecycle events and bounded retry/dead-letter state.
- `webhook` delivery attempts for lifecycle events.
- `suppression` evidence for the source email or primary recipient when a tenant-scoped suppression exists.

Request-log metadata stays sanitized. OpenSend does not expose raw API keys, Authorization headers, cookies, attachment content, or message body fields in trace details.

## Limits

Trace reads are bounded to the selected email and authenticated tenant. Associated request logs are capped, webhook delivery evidence is capped, and tag details are shown as `name=value` pairs from the stored email record.
