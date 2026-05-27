# Managing Webhooks

Use OpenSend webhooks to receive signed lifecycle events from your own OpenSend deployment.

Webhooks are tenant-scoped. A webhook endpoint subscribes to one or more supported event types and receives deliveries only for events created by the same OpenSend user or API-key owner.

## Delivery envelope

OpenSend sends each delivery as an HTTP `POST` with JSON:

```json
{
  "id": "whd_6f6f8b7e_1",
  "type": "email.delivered",
  "created_at": "2026-05-10T00:00:00.000Z",
  "data": {
    "email_id": "6f6f8b7e-534f-4b62-b0c1-64b79e45f3c2"
  }
}
```

The `id` is delivery-attempt scoped, `type` is the webhook event type, `created_at` is the dispatch attempt time, and `data` is the stored event payload.

## Headers

OpenSend signs deliveries with Svix-compatible header names:

| Header | Description |
| --- | --- |
| `svix-id` | Delivery attempt identifier. |
| `svix-timestamp` | Unix timestamp in seconds used in the signature input. |
| `svix-signature` | `v1,<base64-hmac-sha256>` signature. |

## Supported events

See [Event Types](./event-types.md) for the exact event catalog. The catalog is generated from the event types accepted by the OpenSend API and dispatcher; unsupported events are rejected at webhook create/update time or marked terminal if an old stored event cannot be mapped.

## Operational notes

- Endpoint URLs are validated for outbound safety before create/update and again at dispatch time.
- OpenSend stores delivery attempts with status, response status code, response body snippet, next retry time, and timestamps.
- Replays create a new pending delivery for the original event and dispatch it through the same signing path.
