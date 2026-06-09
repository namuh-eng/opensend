# Get domain deliverability readiness

Returns readiness/status information for one tenant-owned domain.

```http
GET /api/domains/{id}/deliverability
Authorization: Bearer <api_key>
```

The response includes BIMI DNS/readiness checks, Apple Branded Mail operator notes, and the last status check time. OpenSend v1 performs DNS/status evaluation only; it does not provision BIMI, Apple Branded Mail, or dedicated IP provider resources.

## Update operator metadata

```http
PATCH /api/domains/{id}/deliverability
Authorization: Bearer <api_key>
Content-Type: application/json
```

Supported fields:

- `bimi_selector`
- `bimi_logo_url`
- `bimi_certificate_url`
- `bimi_notes`
- `apple_branded_mail_status`: `not_started`, `requested`, `approved`, `rejected`, or `manual_review`
- `apple_branded_mail_notes`

All reads and writes are scoped to the authenticated tenant and return `404` for domains owned by another tenant.
