# Receiving Routes API

Create, list, update, retrieve, and delete receiving routes for verified receiving domains.

Routes are tenant-scoped. API key callers need a full-access key that belongs to the domain owner. Dashboard session callers use the same `/api/receiving/routes` endpoints from the Receiving page.

## Route object

```json
{
  "object": "receiving_route",
  "id": "22222222-2222-4222-8222-222222222222",
  "domain_id": "11111111-1111-4111-8111-111111111111",
  "domain": "inbound.example.com",
  "type": "alias",
  "local_part": "help",
  "target_local_part": "support",
  "target_address": "support@inbound.example.com",
  "created_at": "2026-05-28T00:00:00.000Z",
  "updated_at": "2026-05-28T00:00:00.000Z"
}
```

`type` is one of `exact`, `alias`, or `catch_all`. `catch_all` routes use `local_part: null` and require `target_local_part`.

## List routes

`GET /api/receiving/routes`

Optional query parameter:

| Name | Type | Description |
| --- | --- | --- |
| `domain_id` | UUID | Limit results to one owned domain. Cross-tenant domains return `404`. |

Response:

```json
{
  "object": "list",
  "data": []
}
```

## Create a route

`POST /api/receiving/routes`

```json
{
  "domain_id": "11111111-1111-4111-8111-111111111111",
  "type": "alias",
  "local_part": "help",
  "target_local_part": "support"
}
```

Creation requires a verified domain with receiving enabled. Exact routes may omit `target_local_part`; OpenSend then uses the exact local part as the target. Alias and catch-all routes require `target_local_part`.

## Retrieve a route

`GET /api/receiving/routes/{id}`

Missing and cross-tenant route IDs both return `404`.

## Update a route

`PATCH /api/receiving/routes/{id}`

```json
{
  "target_local_part": "inbox"
}
```

You can update `local_part` and `target_local_part`. Route type and domain are immutable; create a new route when those need to change.

## Delete a route

`DELETE /api/receiving/routes/{id}`

Response:

```json
{
  "object": "receiving_route",
  "id": "22222222-2222-4222-8222-222222222222",
  "deleted": true
}
```

## Matching behavior

Inbound workers should resolve route decisions before inserting or updating received email rows. Precedence is exact address, then alias, then catch-all, then unrouteable. Store the resulting `route_decisions` array on `received_emails` so later detail views, logs, and webhook processors can audit the routing choice.
