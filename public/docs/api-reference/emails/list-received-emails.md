# List Received Emails

List inbound email rows stored for the authenticated OpenSend tenant.

`GET /emails/receiving`

Compatibility note: `GET /api/emails/receiving` remains available for existing OpenSend integrations; new API clients can use the root compatibility path above. Browser dashboard navigation is preserved for page routes that share these names.

## Authentication

Use an OpenSend API key in the Authorization header. The API key must belong to a tenant; dashboard session cookies are not API credentials for public API calls.

```http
Authorization: Bearer os_YOUR_API_KEY
```

## Query parameters

| Name | Type | Description |
| --- | --- | --- |
| `limit` | number | Number of rows to return. Values are clamped from `1` to `100`; default is `20`. |
| `after` | string | Cursor for older rows. OpenSend compares against received-email IDs and returns rows after that cursor in descending order. |
| `to` | string | Optional recipient address filter. OpenSend normalizes whitespace and case before querying the recipient array. |

## Response

```json
{
  "object": "list",
  "data": [
    {
      "id": "6f6f8b7e-534f-4b62-b0c1-64b79e45f3c2",
      "from": "support@example.com",
      "to": ["agent@inbound.example.com"],
      "subject": "New support request",
      "route_decisions": [
        {
          "recipient": "agent@inbound.example.com",
          "status": "exact",
          "routeId": "22222222-2222-4222-8222-222222222222",
          "routeType": "exact",
          "targetAddress": "agent@inbound.example.com"
        }
      ],
      "reply_match_status": "unmatched",
      "thread_id": null,
      "reply_to_email_id": null,
      "contact_id": null,
      "created_at": "2026-05-10T00:00:00.000Z"
    }
  ],
  "has_more": false
}
```

Rows are scoped to the owner of the API key. `route_decisions` is an empty array for legacy rows inserted before route audit metadata existed. `reply_match_status` is `matched` when the ingester validated a tenant/domain-scoped reply token and linked the message to an outbound email thread; otherwise it is `unmatched`. Empty lists are returned as `200` responses with `data: []`.

## Self-hosting notes

Hosted OpenSend provisions SES receipt rules when receiving is enabled for a domain, then writes `received_emails` after the ingester resolves the recipient to one tenant and stores attachments through the storage abstraction. Self-hosted deployments should set `SES_INBOUND_SNS_TOPIC_ARN` and `S3_BUCKET_NAME` or `SES_INBOUND_BUCKET_NAME`, subscribe the inbound SNS topic to `/events/inbound/ses-s3`, and add the MX records shown in the dashboard.
