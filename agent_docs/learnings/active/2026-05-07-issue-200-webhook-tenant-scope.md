---
date: 2026-05-07
issue: "#200"
type: decision
promoted_to: null
---

## Webhook APIs require tenant-owned predicates

Webhook list/create/detail/update/delete now resolve a concrete caller `userId` from API-key or dashboard auth via `src/app/api/webhooks/auth.ts`, reject requests without one, stamp new webhooks with that user, and include `webhooks.user_id` in every ownership read and mutation. The dashboard `(dashboard)/webhooks/page.tsx` uses the server session to scope its query.

The `@opensend/core` `webhookRepo` keeps `userId` optional on `findById`, `update`, `delete`, and `list` so the SES ingester (`packages/ingester/src/index.ts`) and the dispatcher (`packages/ingester/src/dispatcher.ts`) — which need cross-tenant lookups for SES event fan-out — keep working. The public surface is locked down at the service layer (`createWebhookService.listWebhooks/getWebhook/updateWebhook/deleteWebhook` make `userId` required, `createWebhook` requires it on its input).

## Follow-up: ingester webhook fan-out is also cross-tenant

`packages/ingester/src/index.ts:345` calls `webhookRepo.list({ limit: 100 })` to dispatch every SES event to every active webhook in the entire database, regardless of which tenant owns the underlying email. This means a bounce on user A's email currently fires user B's webhook. Fix is to look up the originating email's `user_id` from the SES event metadata and filter `webhookRepo.list({ userId })` to that tenant before dispatching. Tracked separately from this PR.
