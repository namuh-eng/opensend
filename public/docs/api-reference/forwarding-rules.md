# Forwarding Rules API

Create, list, update, and delete automatic inbound forwarding rules for receiving routes.

Forwarding rules are tenant-scoped. Each rule belongs to one receiving route and can forward matching received email to one or more external destination addresses after the inbound MIME message has already been stored. OpenSend records every queued, skipped, or failed forwarding attempt so disabled rules, invalid rules, loop-prevention blocks, and send-boundary failures remain auditable.

## List forwarding rules

`GET /api/receiving/forwarding-rules`

Optional query parameters:

| Parameter | Type | Description |
| --- | --- | --- |
| `domain_id` | string | Limit rules to one owned receiving domain. |

The response includes each rule and its latest forwarding attempt when one exists.

```json
{
  "object": "list",
  "data": [
    {
      "object": "forwarding_rule",
      "id": "rule-id",
      "domain_id": "domain-id",
      "domain": "inbound.example.com",
      "route_id": "route-id",
      "route_target_address": "support@inbound.example.com",
      "destinations": ["ops@example.net"],
      "status": "active",
      "invalid_reason": null,
      "last_attempt": null
    }
  ]
}
```

## Create a forwarding rule

`POST /api/receiving/forwarding-rules`

```json
{
  "route_id": "route-id",
  "destinations": ["ops@example.net", "archive@example.net"],
  "status": "active"
}
```

`destinations` must contain 1 to 25 valid email addresses. OpenSend normalizes and deduplicates addresses. Active rules cannot point back to the same receiving domain or matched receiving address; loop-prevention violations return `422` and are not activated. Use `status: "disabled"` when you want to save a rule without forwarding future inbound messages yet.

## Update a forwarding rule

`PATCH /api/receiving/forwarding-rules/{id}`

```json
{
  "destinations": ["new-ops@example.net"],
  "status": "disabled"
}
```

Only `active` and `disabled` are client-settable statuses. OpenSend may surface `invalid` for rules that are no longer safe to run. Disabled or invalid rules do not delete received email; matching inbound messages create skipped forwarding attempts with an explanatory reason.

## Delete a forwarding rule

`DELETE /api/receiving/forwarding-rules/{id}`

```json
{
  "object": "forwarding_rule",
  "id": "rule-id",
  "deleted": true
}
```

## Forwarding attempts

When inbound ingestion stores a received email and its route decision matches an active forwarding rule, OpenSend creates a new outbound email through the existing send queue boundary and writes a `forwarding_attempts` row linked to the received email, rule, tenant, destinations, and forwarded outbound email ID.

Attempt statuses:

| Status | Meaning |
| --- | --- |
| `queued` | A forwarded outbound email row was created and queued for delivery. |
| `skipped` | The message was preserved, but forwarding did not run because the rule was disabled, invalid, or blocked by loop prevention. |
| `failed` | OpenSend tried to create the forwarded outbound email but the send boundary returned an error. |
