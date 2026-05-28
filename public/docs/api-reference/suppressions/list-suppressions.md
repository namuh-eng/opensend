# List Suppressions

List tenant-scoped suppressed recipients for the authenticated OpenSend account.

`GET /api/suppressions`

## Authentication

Use a full-access OpenSend API key in the Authorization header for public API clients. The dashboard uses the same handler with an authenticated dashboard session.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Query parameters

- `limit`: 1-100 rows. Defaults to 50.
- `after`: cursor used by the existing suppression list contract.
- `q`, `search`, or `email`: search by suppression email, suppression id, source email id, or source message id.
- `reason`: `manual`, `bounced`, or `complained`.
- `source`: `manual`, `operator`, or `ses` when present in suppression metadata.
- `created_after` / `created_before`: date or ISO timestamp matched against `suppressed_at`.
- `domain`: filters suppressions linked to a source email whose `from` value contains that domain. Manual/imported suppressions do not carry source-domain evidence.
- `topic_id`: filters suppressions linked to a source email with that topic id. Manual/imported suppressions do not carry source-topic evidence.

## Response

```json
{
  "object": "list",
  "scope": "user",
  "data": [
    {
      "id": "0f1b8c7d-...",
      "object": "suppression",
      "email": "bounced@example.com",
      "reason": "bounced",
      "scope": "user",
      "source_event_id": "evt_123",
      "source_email_id": "2d9b...",
      "source_message_id": "0100018...",
      "metadata": { "source": "ses" },
      "suppressed_at": "2026-05-28T00:00:00.000Z",
      "updated_at": "2026-05-28T00:00:00.000Z"
    }
  ],
  "has_more": false
}
```

## Tenant scope

The response only includes suppressions owned by the API key or dashboard session user. Missing or cross-tenant records are not disclosed.
