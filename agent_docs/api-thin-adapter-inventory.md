# Next API thin-adapter/control-plane inventory

Issue: [#307](https://github.com/namuh-eng/opensend/issues/307)
Parent tracker: [#71](https://github.com/namuh-eng/opensend/issues/71)
Inventory date: 2026-05-10

## Scope and non-goals

This is an architecture inventory for the remaining `src/app/api/**/route.ts`
surfaces. It does **not** move runtime behavior, change response shapes, or start a
broad Hono migration.

Non-goals for this slice:

- No public API shape changes.
- No Go ingester parity work.
- No broad route migration.
- No provider-side behavior changes for SES, S3, Cloudflare, Stripe, queues, or
  webhooks.

## Current boundary snapshot

- `src/app/api/**/route.ts` contains 62 Next route files across 21 top-level
  families.
- `services/api` is an independent Hono/Bun control-plane skeleton. It currently
  owns `/healthz`, `/readyz`, `/mcp`, `/emails`, and `/emails/batch` only.
- `services/api/src/index.ts` reuses shared handlers from
  `src/lib/api/emails/send.ts` and `src/lib/api/emails/batch-send.ts`; those
  handlers still import app-layer auth, billing quota, DB schema, API logging,
  suppression, unsubscribe, template, attachment, queue, and telemetry modules.
- `packages/core` already exports repositories for most route families and
  higher-level services for API keys, domains, webhooks, email/background jobs,
  provider/storage, DNS, telemetry, and webhook events.
- The safest near-term migration shape remains: extract or harden a reusable
  service/handler behind the existing Next route first, assert response parity in
  route tests, then add a Hono adapter only when auth and side-effect seams are
  explicit.

## Already partially extracted surfaces

| Surface | Current state | Remaining migration concern |
| --- | --- | --- |
| `POST /api/emails` and `POST /api/emails/batch` | Next routes are thin wrappers around `src/lib/api/emails/{send,batch-send}.ts`; Hono exposes `/emails` and `/emails/batch` through the same handlers. | Shared handlers still live under `src/lib` and depend on Next-app concerns. Deeper core extraction should be seam-by-seam, not in a route adapter PR. |
| `api-keys` | Next routes call `createApiKeyService()` from `@opensend/core`; route still owns dashboard/API-key auth, quota, request parsing, response mapping, and cache invalidation injection. | Hono parity needs a clear auth policy for dashboard-created keys and API-key callers before moving the route surface. |
| `webhooks` | Next routes call `createWebhookService()` from `@opensend/core`; route owns API-key auth, Zod parsing, status/error mapping, and public response shape. | Good candidate for the next control-plane slice because it is API-key-only and provider-free. |
| `domains` root and verify | `POST/GET /api/domains` uses `createDomainService()` with SES and cache injections; verify delegates to core `domainService`. | `domains/[id]` still owns DB updates, cache invalidation, Cloudflare DNS cleanup, SES identity deletion, queue events, and response mapping. |
| `automations` root/detail | Some validation and CRUD use `automationRepo` from core. | Next routes still compose step counts, last-run summaries, direct transactions, run queries, cancellation, and public formatting. |

## Remaining route-family inventory

| Family | Route files | Current ownership/coupling | Response/error shape risks | Test anchors | Migration recommendation |
| --- | --- | --- | --- | --- | --- |
| Automations and custom events | `src/app/api/automations/route.ts`, `src/app/api/automations/[id]/route.ts`, `src/app/api/automations/[id]/runs/route.ts`, `src/app/api/automations/[id]/runs/[runId]/route.ts`, `src/app/api/automations/[id]/runs/[runId]/cancel/route.ts`, `src/app/api/automations/[id]/runs/metrics/route.ts`, `src/app/api/events/route.ts`, `src/app/api/events/send/route.ts` | Mixed ownership: `automationRepo`/`customEventRepo` own some persistence, but routes still own auth, Zod parsing, direct `db` queries, step/run composition, cancellation state transitions, contact upsert for event sends, and response formatting via `src/lib/automations`. | Inconsistent simple `{ error }` failures plus `{ error, code }` validation/domain failures; public SDK paths exercise `/api/automations`, runs, cancel, metrics, and `/api/events/send`. | `tests/api-automations-events.test.ts`, `tests/automations-schema.test.ts`, `tests/automation-runner.test.ts`, `tests/core-automation-repo.test.ts`, `tests/sdk-client.test.tsx`, `tests/e2e/automations-dashboard.spec.ts`. | Delay broad Hono migration. First extract run read/cancel and custom-event send orchestration into core/service handlers with route parity tests, because this family touches automation runner semantics and schema dialects. |
| Broadcasts | `src/app/api/broadcasts/route.ts`, `src/app/api/broadcasts/[id]/route.ts`, `src/app/api/broadcasts/[id]/send/route.ts`, `src/app/api/broadcasts/[id]/metrics/route.ts` plus `src/app/api/broadcasts/auth.ts` | Routes own dashboard/API-key auth helper, direct `db` CRUD, send status transition, metrics SQL, date filtering, and response mapping. `broadcastRepo` exists but is not the route boundary. | CRUD returns a mix of list/object payloads and plain `{ error }`; send has state-precondition responses; metrics returns dashboard-shaped aggregates. | `tests/broadcast-tenant-routes.test.ts`, `tests/broadcast-metrics-route.test.ts`, `tests/broadcasts-list.test.ts`, `tests/broadcast-editor*.test.tsx`, `tests/e2e/broadcast*.spec.ts`. | Split into two slices: CRUD/list first, then send/metrics. Keep dashboard auth helper and public API response casing unchanged. |
| Contacts audience core | `src/app/api/contacts/route.ts`, `src/app/api/contacts/[id]/route.ts`, `src/app/api/contacts/bulk/route.ts`, `src/app/api/contacts/import/route.ts`, `src/app/api/contacts/[id]/segments/route.ts`, `src/app/api/contacts/[id]/segments/[segment_id]/route.ts`, `src/app/api/contacts/[id]/topics/route.ts` | Routes own dashboard/API-key auth, direct `db` queries/mutations, segment/topic resolution, bulk state changes, import parsing, contact webhook queue events, and response mapping. `contactRepo` exists but route-specific relationship behavior remains in Next. | High compatibility risk from duplicate handling (`409`), list pagination/search/status filters, alias-by-id-or-email behavior, segment/topic response shapes, and tenant isolation expectations. | `tests/contact-root-api.test.ts`, `tests/contact-tenant-isolation.test.ts`, `tests/contacts-list.test.ts`, `tests/contact-detail.test.tsx`, `tests/add-contact-modal.test.tsx`, `tests/e2e/contacts-list.spec.ts`, `tests/e2e/contact-detail.spec.ts`, `tests/e2e/tenant-isolation.spec.ts`. | Migrate after templates/segments. Extract contact service around user-scoped CRUD and relationship mutations before introducing Hono. |
| Templates | `src/app/api/templates/route.ts`, `src/app/api/templates/[id]/route.ts`, `src/app/api/templates/[id]/duplicate/route.ts`, `src/app/api/templates/[id]/publish/route.ts` | Routes own API-key auth, direct `db` CRUD, status filtering, variable normalization/validation, publish/duplicate side effects, and response mapping. `templateRepo` exists but route behavior is not service-owned. | Moderate risk: validation returns `422` with flattened details; publish rejects non-draft templates; duplicate names and variable structures must remain stable for editor/dashboard callers. | `tests/api-template-variables.test.ts`, `tests/templates-list.test.tsx`, `tests/e2e/templates-list.spec.ts`, `tests/e2e/automations-dashboard.spec.ts`. | Safe early slice. No provider calls, no queues, and focused tests exist. Extract a `templateService` or shared handler first, then optionally add Hono parity. |
| Segments, topics, and contact properties | `src/app/api/segments/route.ts`, `src/app/api/segments/[id]/route.ts`, `src/app/api/segments/[id]/contacts/route.ts`, `src/app/api/topics/route.ts`, `src/app/api/topics/[id]/route.ts`, `src/app/api/properties/route.ts`, `src/app/api/properties/[id]/route.ts` | Routes own API-key/dashboard auth variants, direct `db` list/create/update/delete, user-scoped lookups in some paths, contact join queries, and response mapping. `segmentRepo`, `topicRepo`, and property tables exist but not service boundaries. | Pagination fields (`object`, `data`, `has_more`, `total`), validation status codes, and user scoping differ by route. Topic/property tests should guard casing and status codes. | `tests/segments-list.test.ts`, `tests/e2e/segments.spec.ts`, `tests/topics.test.ts`, `tests/e2e/topics.spec.ts`, `tests/properties.test.tsx`, `tests/e2e/properties.spec.ts`, `tests/api-auth-date-range-routes.test.ts`. | Safe early-to-mid slice after templates. Keep as audience metadata service extraction; do not fold contact relationship mutations into the same PR. |
| Dashboard metrics | `src/app/api/metrics/route.ts` | Dashboard-only route owns session auth, cache reads/writes, date-range mapping, direct SQL aggregations, domain/event filters, and response assembly. | Dashboard payload has many derived fields; cache headers (`x-opensend-cache`) and date range/event mappings are compatibility-sensitive. | `tests/metrics-route.test.ts`, `tests/metrics-page.test.ts`, `tests/e2e/metrics-deliverability.spec.ts`, `tests/api-auth-date-range-routes.test.ts`. | Leave in Next until public control-plane routes are further along. If extracted, make it a dashboard metrics service, not a Hono public API slice. |
| Email read side, attachments, cancel, and events | `src/app/api/emails/route.ts` for `GET`/`DELETE`, `src/app/api/emails/[id]/route.ts`, `src/app/api/emails/[id]/cancel/route.ts`, `src/app/api/emails/[id]/events/route.ts`, `src/app/api/emails/[id]/attachments/route.ts`, `src/app/api/emails/[id]/attachments/[attachmentId]/route.ts`, `src/app/api/emails/receiving/route.ts`, `src/app/api/emails/receiving/[id]/route.ts`, `src/app/api/emails/receiving/[id]/attachments/route.ts`, `src/app/api/emails/receiving/[id]/attachments/[attachmentId]/route.ts` | Routes own API-key auth, permission checks, direct `db` reads/updates/deletes, public error envelope use in `[id]`, event listing, S3 presigned attachment URLs, received-email reads, and response mapping. `emailRepo`, `emailEventRepo`, and `storageService` exist but are not route boundaries here. | High public API risk: `/api/emails/[id]` uses `publicApiError` for some failures while siblings use plain `{ error }`; list/cancel/delete shapes and attachment URL payloads must remain byte-compatible enough for SDK/users. | `tests/api-emails.test.ts`, `tests/quota-routes.test.ts`, `tests/issue-200-missed-tenant-scope.test.tsx`, `tests/email-detail*.test.tsx`, `tests/emails-*.test.tsx`, `tests/e2e/email-detail*.spec.ts`, `tests/e2e/emails-*.spec.ts`, `tests/sdk-client.test.tsx`, `tests/middleware-rate-limit.test.ts`. | Migrate after webhooks/templates. Split into read/list/detail first, then cancel, then attachments/receiving. Do not combine with send-handler core extraction. |
| Domains detail/delete | `src/app/api/domains/[id]/route.ts` plus root/verify follow-ups | Detail route owns cached reads, direct `db` patch, cache invalidation, domain webhook queue events, Cloudflare DNS record cleanup, SES identity deletion, and response mapping. Root and verify are partially core-backed. | Provider side effects and queue events make rollback costly. Error shapes vary between `Validation failed`, `Not found`, `Internal server error`, and provider cleanup fallbacks. | `tests/api-domains.test.ts`, `tests/domain-service.test.ts`, `tests/domain-validation.test.ts`, `tests/domain-detail*.test.tsx`, `tests/domain-dns-records.test.tsx`, `tests/e2e/domain*.spec.ts`, `tests/quota-routes.test.ts`, `tests/cache-invalidation-routes.test.ts`. | Delay destructive/provider operations. If continued, extract patch response mapping before delete/provider cleanup. |
| Webhooks | `src/app/api/webhooks/route.ts`, `src/app/api/webhooks/[id]/route.ts` | Core service owns CRUD/list/detail and delivery lookup; routes own API-key auth, Zod parsing, endpoint/event alias mapping, response shape, and status-code mapping. | Low-to-moderate risk: `signing_secret` appears only on create; detail includes deliveries; status mapping must remain public. | `tests/webhook-service.test.ts`, `tests/webhooks-api-keys-tenant-isolation.test.ts`, `tests/webhook-event-types.test.tsx`, `tests/webhook-lifecycle-queue.test.ts`, `tests/webhook-dispatcher.test.ts`. | Safest Hono/control-plane candidate. Add adapter parity around the existing service rather than changing service behavior. |
| API keys | `src/app/api/api-keys/route.ts`, `src/app/api/api-keys/[id]/route.ts` | Core service owns key list/create/detail/delete; routes own dashboard/API-key auth, quota, permission checks, request body parsing, response shape, and auth cache invalidation injection. | Token is returned only on create; dashboard auth path is Next-specific; quota failures use shared billing response. | `tests/api-key-service.test.ts`, `tests/webhooks-api-keys-tenant-isolation.test.ts`, `tests/api-key-detail.test.tsx`, `tests/api-keys-*.test.tsx`, `tests/e2e/api-key-detail.spec.ts`, `tests/quota-routes.test.ts`, `tests/cache-invalidation-routes.test.ts`. | Safe after webhooks, but only after deciding whether `services/api` should support dashboard-session auth or only API-key-authenticated control-plane calls. |
| Logs | `src/app/api/logs/route.ts`, `src/app/api/logs/[id]/route.ts` | Routes own API-key auth, direct log queries, filters, user/API-key scoping, and response mapping. `logRepo` exists. | Search/date/API-key filters and tenant isolation are sensitive; mostly read-only. | `tests/api-logs.test.ts`, `tests/issue-200-missed-tenant-scope.test.tsx`, `tests/e2e/logs-search.spec.ts`. | Good read-only extraction candidate, but not a top control-plane priority unless observability APIs are part of the next milestone. |
| Suppressions | `src/app/api/suppressions/route.ts`, `src/app/api/suppressions/[email]/route.ts` | Routes are thin around `suppressionRepo` with API-key/dashboard auth resolution. | Response shape is small, but auth mode differs from most public API-key-only routes. | `tests/suppressions-route.test.ts`, suppression behavior in send tests. | Small safe slice if batching with audience metadata is desired; otherwise leave until contact/audience services are defined. |
| Billing | `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/portal/route.ts`, `src/app/api/billing/plans/route.ts`, `src/app/api/billing/summary/route.ts` | Routes own dashboard session auth, Stripe backend selection, Stripe customer/session orchestration, plan/subscription repositories, and billing summary mapping. | Stripe errors, disabled-billing fallbacks, and dashboard-only semantics should not be mixed into public control-plane migration. | `tests/stripe-webhook.test.ts`, quota tests, billing support tests if added. | Keep in Next/dashboard path for now. |
| Usage, health, invites, auth, internal cron | `src/app/api/usage/route.ts`, `src/app/api/health/route.ts`, `src/app/api/invites/route.ts`, `src/app/api/auth/[...all]/route.ts`, `src/app/api/internal/cron/process-scheduled/route.ts` | Mixed app/runtime responsibilities: Better Auth handler, dashboard session usage counts, health DB probe, invite lookup, and cron secret checks. | Mostly internal/dashboard shapes; health overlaps with `services/api` health but is app-specific. | `tests/api-service-health.test.ts`, dashboard/e2e auth-adjacent coverage. | Not part of the next public control-plane migration. Preserve unless a deployment slice requires app/service health parity. |
| Settings | No `src/app/api/settings/**/route.ts` files found in this checkout. | No current Next route surface to migrate. | None. | None. | No action. |

## Cross-cutting risks to preserve

1. **Auth modes are not uniform.** Some routes are API-key-only
   (`webhooks`, most email public APIs), some allow dashboard or API key
   (`contacts`, `domains`, `api-keys`, audience metadata), and dashboard routes
   use Better Auth session lookup. Hono slices should not silently drop a caller
   mode.
2. **Error envelopes are inconsistent by design today.** Send APIs and parts of
   email detail use public API error envelopes, while most dashboard/audience
   routes return plain `{ error }` with ad hoc `details` or `code`. Thin-adapter
   work must first lock current status codes and bodies in tests.
3. **Provider and queue side effects should be isolated.** Domain delete/patch,
   email send, contact/domain webhooks, broadcast send, and event send all cross
   process/provider boundaries. Avoid moving these until service contracts expose
   injectable dependencies and idempotent test seams.
4. **Existing core repositories are not equivalent to API contracts.** Many repos
   expose persistence primitives, while route handlers still own filters,
   pagination cursors, public casing, and relationship expansion.
5. **Dashboard-only routes do not need Hono parity by default.** Metrics, billing,
   usage, invites, and Better Auth can remain Next-owned unless a later issue
   explicitly widens control-plane scope.

## Recommended migration order

1. **Webhooks adapter parity** — already service-backed, API-key-only,
   provider-free, and covered by tenant/service tests.
2. **Templates service extraction** — DB-only public/dashboard API-key route
   family with concrete variable/publish/duplicate tests.
3. **Segments/topics/properties audience metadata** — simple CRUD/list surfaces;
   keep contact relationship mutations out of this slice.
4. **API keys adapter parity** — service-backed but requires explicit decision on
   dashboard session support in `services/api` and quota/cache seams.
5. **Email read/list/detail** — public API but response-envelope compatibility is
   more sensitive; defer cancel and attachments to separate follow-ups.
6. **Broadcast CRUD** — separate from broadcast send and metrics.
7. **Contacts** — broad relationship/webhook/tenant-isolation coupling; migrate
   after metadata services are stable.
8. **Automations/custom events** — runner/schema/cancellation semantics require
   a dedicated design slice.
9. **Domains detail/delete** — provider and Cloudflare/SES cleanup side effects
   should stay late.
10. **Dashboard/internal routes** — metrics, billing, usage, invites, auth,
    health, and cron stay Next-owned unless a later issue changes scope.

## Next safest child slices

### Slice A: Webhooks Hono/control-plane parity

**Files to inspect/change**

- `src/app/api/webhooks/route.ts`
- `src/app/api/webhooks/[id]/route.ts`
- `packages/core/src/services/webhook.ts`
- `services/api/src/index.ts`
- `tests/webhook-service.test.ts`
- `tests/webhooks-api-keys-tenant-isolation.test.ts`
- A new route-parity or service API test under `tests/` if Hono endpoints are
  added.

**Acceptance criteria**

- Existing Next webhooks routes keep their current response bodies, status codes,
  auth failures, and `signing_secret` create-only behavior.
- Any Hono endpoint added for webhooks delegates to the same core service and is
  covered by API-key-authenticated tests.
- No webhook delivery signing, dispatcher, lifecycle queue, or event-type
  behavior changes.
- `make check` and targeted webhook tests pass.

### Slice B: Templates service extraction

**Files to inspect/change**

- `src/app/api/templates/route.ts`
- `src/app/api/templates/[id]/route.ts`
- `src/app/api/templates/[id]/duplicate/route.ts`
- `src/app/api/templates/[id]/publish/route.ts`
- `packages/core/src/db/repositories/templateRepo.ts`
- A new `packages/core/src/services/template.ts` only if the slice explicitly
  extracts service behavior.
- `tests/api-template-variables.test.ts`
- `tests/templates-list.test.tsx`
- `tests/e2e/templates-list.spec.ts`

**Acceptance criteria**

- Template create/list/detail/update/delete/publish/duplicate status codes and
  response fields are unchanged.
- Variable normalization/validation behavior remains covered by
  `tests/api-template-variables.test.ts`.
- The Next route becomes `auth -> parse -> service/handler -> HTTP mapping`, or
  the PR documents why one of those responsibilities must remain in the adapter.
- No editor/dashboard UI behavior changes.
- `make check` and targeted template tests pass.

## Validation for this inventory

This PR changes documentation only. Required validation is `make check`; broader
unit/e2e suites are not required unless a code-adjacent file changes.
