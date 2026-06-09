# Dedicated IP lifecycle

Dedicated IP APIs track manual lifecycle state for a tenant. They do not provision provider IP pools or run warmup flows in v1.

```http
POST /api/dedicated-ips
Authorization: Bearer <api_key>
Content-Type: application/json
```

Creates a lifecycle record with status `requested`. Operators can later update the record to `provisioned`, `warming`, `active`, `suspended`, or `retired`.

```http
PATCH /api/dedicated-ips/{id}
Authorization: Bearer <api_key>
Content-Type: application/json
```

Use `provider_pool_name` and `operator_notes` to record external provider work performed outside OpenSend. `DELETE /api/dedicated-ips/{id}` marks the record `retired` so the lifecycle remains auditable.
