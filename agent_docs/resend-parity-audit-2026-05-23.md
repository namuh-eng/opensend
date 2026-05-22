# Resend parity audit — OpenSend (2026-05-23)

Branch: `resend-parity-audit` · Base: `origin/main` · Method: code/route/OpenAPI inspection (no feature work).

This is a point-in-time **audit**. It surfaces the gap matrix and a prioritized
recommendation list, then stops for review. No feature code was written. The
ongoing autonomous-loop tracker (`agent_docs/resend-parity.md`) is left untouched;
this file is a fresh full-surface sweep that the tracker can be reconciled against.

Resend was used only as private parity inspiration — no competitor links appear
here or in any public-facing file.

## Legend

- **Present** — parity in code with Resend's documented behavior.
- **Partial** — implemented but with a material gap.
- **Missing** — not implemented.
- **Lead** — OpenSend ships this where Resend does not (parity is not at risk; noted for completeness).

---

## Summary scoreboard

| Area | Present | Partial | Missing |
|---|---|---|---|
| API (REST) | 9 | 3 | 1 |
| SDK | 2 | 5 | 3 |
| Dashboard | 13 | 1 | 0 |
| Webhooks | 5 | 1 | 0 |
| Deliverability | 6 | 2 | 1 |
| Automations | 4 (all Lead) | 0 | 0 |

Headline findings:

1. **REST surface is broad and close to parity** — emails, domains, API keys,
   audiences, contacts, broadcasts all Present with idempotency keys and the
   `full_access`/`sending_access` permission model.
2. **OpenAPI spec is ~13 of ~70 routes** — the published contract is materially
   incomplete and also breaches the repo's own docs standard.
3. **Only the TypeScript SDK is real** — Go/Python/Ruby SDKs are send-only stubs.
4. **TS SDK omits `webhooks` and `topics`** namespaces and a `domains.delete`.
5. **Automations are a genuine lead** over Resend, but their DTO comments are
   stale and understate what the runner actually does.

---

## 1. API (REST)

Routes live under `src/app/api/**/route.ts` with Resend-compatible root aliases
(`src/app/emails/`, `src/app/contacts/`, `src/app/audiences/`, `src/app/segments/`,
`src/app/broadcasts/`) plus middleware rewrites in `src/middleware.ts`.

| Resend capability | Status | Evidence | Gap note |
|---|---|---|---|
| Send email (`POST /emails`) | Present | `src/app/api/emails/route.ts:12`; root alias rewrite `src/middleware.ts:419` | Accepts Resend body fields; returns `{ id }`. |
| Batch send (`POST /emails/batch`) | Present | `src/app/api/emails/batch/route.ts:5`; rewrite `src/middleware.ts:423` | Up to 100 payloads, `{ data: [...] }`. |
| Retrieve email (`GET /emails/:id`) | Present | `src/app/api/emails/[id]/route.ts:15` | — |
| Update / reschedule (`PATCH /emails/:id`) | Present | `src/app/api/emails/[id]/route.ts:55` | Reschedules `scheduled_at`. |
| Cancel (`POST /emails/:id/cancel`) | Present | `src/app/api/emails/[id]/cancel/route.ts:11`; alias `src/app/emails/[id]/cancel/route.ts:17` | Normalizes to `{ object: "email", id }`. |
| List emails (`GET /emails`) | Present | `src/app/api/emails/route.ts:16` | Cursor pagination + status filter. |
| Idempotency keys | Present | `Idempotency-Key` header threaded through send/batch handlers | 24h window, 256-char cap. |
| Domains CRUD + verify | Present | `src/app/api/domains/route.ts:58,168`; `[id]/route.ts:79,112,177`; `[id]/verify/route.ts:20` | Full CRUD + verify. |
| API keys (create/list/delete) | Present | `src/app/api/api-keys/route.ts:18,39`; `[id]/route.ts:16,33,71` | `full_access`/`sending_access` (`packages/core/src/services/apiKeys.ts:8`) + domain scoping — matches Resend's model. |
| Audiences | Present | Root alias `src/app/audiences/route.ts:64,89`, `[audience_id]/route.ts:42,62` | Mapped onto segments (`audience_id` → segment id). |
| Contacts CRUD (by id or email) | Present | `src/app/api/contacts/route.ts:37,86`; `[id]/route.ts:41,62,107` | `GET /contacts/:id` resolves id **or** email (`[id]/route.ts:41`). |
| Broadcasts CRUD + send | Present | `src/app/api/broadcasts/route.ts:54,26`; `[id]/route.ts:42,68,100`; `[id]/send/route.ts:12` | — |
| Inbound / receiving email | Present (Lead-ish) | `src/app/api/emails/receiving/route.ts:7`, `[id]/route.ts:10`, attachments routes | List/get/attachments for inbound mail. |
| Suppressions API | **Partial** | `src/app/api/suppressions/route.ts:3` (GET), `[email]/route.ts` (DELETE) | No `POST /api/suppressions` — manual suppression creation is dashboard/auto only (`agent` confirmed no POST route). |
| Scheduled send (natural language) | **Partial** | `scheduled_at` accepted in send validation; worker scans due rows | Per existing tracker (`agent_docs/resend-parity.md`, #240): handlers use raw `new Date(...)`, so `in 1 min`-style strings are not normalized. Carried forward, not re-verified here. |
| OpenAPI contract completeness | **Partial** | `src/lib/openapi.ts:130-998` declares ~13 paths; ~70 route files exist | See §1.1 — major gap, also a CLAUDE.md docs-standard breach. |
| First-party SMTP relay | **Missing** | No `createTransport`/SMTP server in `src/` or `packages/ingester/`; only a bounce diagnostic string at `packages/ingester/src/queue-worker.ts:676`; settings page displays `SMTP_*` env (`src/app/(dashboard)/settings/page.tsx:4`) | Resend offers an SMTP relay. OpenSend operators must point at SES's own SMTP endpoint; there is no OpenSend-branded relay. Doc `public/docs/send-with-smtp.md` exists. |

OpenSend leads not present in Resend's public API: a **Logs API**
(`src/app/api/logs/route.ts:7`, `[id]/route.ts:7` — Resend keeps logs dashboard-only),
**templates CRUD** (`src/app/api/templates/**`, `src/app/api/public/templates/**`),
**topics**, **segments**, **contact properties** (`src/app/api/properties/**`),
and a **custom-events API** (`src/app/api/events/route.ts`, `events/send/route.ts`).

### 1.1 OpenAPI spec gap (detail)

`src/lib/openapi.ts` declares only: `/emails`, `/emails/batch`,
`/emails/{email_id}/cancel`, `/templates` (+`/{id}`, `/publish`, `/duplicate`),
`/api/emails` (GET/POST), `/api/emails/batch`, `/api/emails/{id}` (GET only),
`/api/domains` (GET/POST), `/api/domains/{id}` (GET/DELETE only), `/api/contacts`
(GET/POST).

Not in the spec at all: api-keys, segments, topics, properties, broadcasts,
automations, webhooks, suppressions, logs, events, receiving, billing, and the
root Resend-compatible aliases. Implemented methods missing from declared paths
include `DELETE /api/emails`, `PATCH /api/emails/{id}`, and `PATCH /api/domains/{id}`.
CLAUDE.md requires every implemented public route to be documented and OpenAPI-backed.

---

## 2. SDK

Resend ships full-surface SDKs in Node, Python, Ruby, PHP, Go, and more.
OpenSend ships four packages — one complete, three stubs.

| SDK | Status | Evidence | Gap note |
|---|---|---|---|
| TypeScript (`packages/sdk/`, npm `opensend` v0.1.0) | Present | `packages/sdk/src/index.ts` — 10 namespaces (`emails`, `domains`, `apiKeys`, `contacts`, `segments`, `audiences`, `broadcasts`, `templates`, `automations`, `events`) at `index.ts:1049-1058` | Broad coverage; `Resend` alias class at `index.ts:1080`. Strict, no `any`. See gaps below. |
| Go (`packages/go-sdk/`) | **Partial** | `packages/go-sdk/opensend.go:133` — only `Client.Send` | Single send only. No batch, domains, contacts, etc. |
| Python (`packages/python-sdk/`) | **Partial** | `packages/python-sdk/src/opensend/__init__.py:156,173` — `emails.send`, `emails.send_batch` | Send + batch only. |
| Ruby (`packages/ruby-sdk/`) | **Partial** | `packages/ruby-sdk/lib/opensend.rb:171` — `EmailsResource#send` | Single send only. |
| MCP server (`packages/mcp/`) | Present | 12 tools in `packages/mcp/src/schema.ts` (send/list/get email, create/list/get contact, create/list/get domain, create/list/get webhook); stdio + http transports (`stdio.ts`, `http.ts`) | Resend also ships an MCP server — at parity. |

TypeScript SDK gaps vs the REST surface it should cover:

| SDK gap | Status | Evidence | Gap note |
|---|---|---|---|
| `webhooks` namespace | **Missing** | No `Webhooks` class in `packages/sdk/src/index.ts`; not assigned in constructor `index.ts:1049-1058` | Webhooks are a first-class API resource (`/api/webhooks`); SDK users cannot manage them. |
| `topics` namespace | **Missing** | No `Topics` class in `index.ts` | `/api/topics` CRUD exists server-side but is unreachable from the SDK. |
| `suppressions` / `logs` namespaces | **Missing** | No such classes in `index.ts` | REST routes exist; SDK does not expose them. |
| `domains.delete` | **Partial** | `Domains` class `index.ts:608-640` exposes create/list/get/update/verify only | `DELETE /api/domains/:id` exists (`[id]/route.ts:177`) but no SDK method. |
| `contacts.list` pagination | **Partial** | `index.ts:673-675` — `list()` takes no args | No `limit`/`after`; other list methods support cursors. |
| `automations`/`events` response typing | **Partial** | `index.ts:933-1045` — every method returns `ApiResponse<unknown>` | Untyped payloads; weak DX vs the concrete types used elsewhere. |
| Automatic retries | Partial (DX) | `HttpClient` `index.ts:488-538` — no retry logic | Minor; Resend's SDKs are also thin here. |

---

## 3. Dashboard

Dashboard pages under `src/app/(dashboard)/**/page.tsx`; nav from
`src/components/sidebar.tsx:8` (`NAV_ITEMS`).

| Resend dashboard area | Status | Evidence |
|---|---|---|
| Overview / "Today" | Present | `src/app/(dashboard)/today/page.tsx` — 24h stat cards + hourly chart |
| Emails (sending list) | Present | `src/app/(dashboard)/emails/page.tsx`; `/emails/sending` redirects here |
| Emails (receiving / inbound) | Present | `src/app/(dashboard)/emails/receiving/page.tsx` |
| Domains | Present | `src/app/(dashboard)/domains/page.tsx`, `[id]/page.tsx` |
| Audience — contacts | Present | `src/app/(dashboard)/audience/page.tsx` |
| Audience — segments | Present (Lead) | `src/app/(dashboard)/audience/segments/page.tsx` |
| Audience — topics | Present (Lead) | `src/app/(dashboard)/audience/topics/page.tsx` |
| Audience — properties | Present (Lead) | `src/app/(dashboard)/audience/properties/page.tsx` |
| Broadcasts (+ editor) | Present | `src/app/(dashboard)/broadcasts/page.tsx`, `[id]/editor/page.tsx` |
| Automations (+ builder) | Present (Lead) | `src/app/(dashboard)/automations/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, run pages |
| Templates (+ editor) | Present (Lead) | `src/app/(dashboard)/templates/page.tsx`, `[id]/editor/page.tsx` |
| Webhooks | Present | `src/app/(dashboard)/webhooks/page.tsx`, `[id]/page.tsx` |
| API keys | Present | `src/app/(dashboard)/api-keys/page.tsx`, `[id]/page.tsx` |
| Logs | Present | `src/app/(dashboard)/logs/page.tsx`, `[id]/page.tsx` |
| Metrics | Present | `src/app/(dashboard)/metrics/page.tsx` |
| Audit log | Present (Lead) | `src/app/(dashboard)/audit-log/page.tsx` |
| Settings + billing | Present | `src/app/(dashboard)/settings/page.tsx`, `settings/billing/page.tsx` |
| Unsubscribe-page customization | **Partial** | `src/app/(dashboard)/audience/topics/unsubscribe-page/edit/page.tsx:11-14` — placeholder; states customization "not yet available" | A default unsubscribe page is still served (`src/app/unsubscribe/[contactId]/route.ts:61`). |

Dashboard coverage is at or ahead of Resend.

---

## 4. Webhooks

| Resend capability | Status | Evidence | Gap note |
|---|---|---|---|
| Event catalog | Present | `packages/core/src/webhook-events.ts:1-16` — 14 types: `email.{sent,delivered,bounced,complained,delivery_delayed,opened,clicked,failed}`, `contact.{created,updated,deleted}`, `domain.{created,updated,deleted}` | Exact match with Resend's documented set. |
| Svix-compatible signing | Present | `packages/core/src/webhook-signing.ts:7-17`; dispatcher sets `svix-id`/`svix-timestamp`/`svix-signature` `packages/ingester/src/dispatcher.ts:112-117` | HMAC-SHA256, `v1,<base64>`, `whsec_` prefix stripped. |
| Secret at rest | Present | `packages/core/src/services/webhook-secret-resolver.ts:16-21` — AES-256-GCM envelope, legacy plaintext still resolves | — |
| Delivery retries + dead-letter | Present | `dispatcher.ts:12` retry schedule `[5,300,1800,7200,18000,36000,36000]`, 8 attempts (`dispatcher.ts:14`); `dead_letter` terminal status | At/ahead of Resend. |
| Delivery history + replay | Present | `webhookDeliveryRepo.listByWebhookId` (`webhookDeliveryRepo.ts:29-49`); replay `src/app/api/webhooks/[id]/deliveries/[deliveryId]/replay/route.ts:3` | — |
| Signing-code duplication | **Partial (hygiene)** | Two implementations: `packages/core/src/webhook-signing.ts` (3-arg, `msgId.timestamp.body`) vs `src/lib/webhook-signing.ts` (2-arg, `timestamp.body`) | Divergent payload construction; drift risk if only one is updated. |

---

## 5. Deliverability

| Resend capability | Status | Evidence | Gap note |
|---|---|---|---|
| DKIM (SES-managed + BYO) | Present | `packages/core/src/services/domain.ts:259-265` (SES CNAME tokens); BYO 2048-bit RSA `dkim-keys.ts:97`, selector `dkim-keys.ts:92` | Versioned AES-256-GCM key encryption (`dkim-keys.ts:62,77`). |
| SPF | Present | `domain.ts:272-278` — `v=spf1 include:amazonses.com ~all` on return-path subdomain |
| DMARC | Present | `domain.ts:289-295` — `_dmarc` TXT `v=DMARC1; p=none;` |
| MX feedback (return path) | Present | `domain.ts:280-287` — `feedback-smtp.<region>.amazonses.com` |
| Open/click tracking toggles | Present | Per-domain `trackOpens`/`trackClicks` (`domain.ts:395-396`); enforced at hit time `trackingRoute.ts:51-52` |
| Custom return-path / MAIL FROM | Present | `domain.ts:11,19` (`DEFAULT_RETURN_PATH`, `getEffectiveReturnPathLabel`); `customReturnPath` field |
| Custom tracking subdomain (CNAME) | Present | `buildTrackingCnameRecord` `domain.ts:75`; `syncTrackingCnameRecord` `domain.ts:92` |
| Region selection | Present | Per-domain `region` (`domain.ts:391`), used at send `queue-worker.ts:432` |
| Suppression list (auto + manual) | Present | Auto from permanent bounces/complaints `packages/ingester/src/index.ts:60-88,395-408`; pre-send block `suppressionRepo.findByUserAndEmails` | Manual *add* not exposed via REST (see §1, suppressions Partial). |
| TLS enforcement | **Partial** | `tls` field stored per-domain (`domain.ts:398`, default `opportunistic`) but **not** passed to any SES `SendEmailCommand` | Setting is inert at send time — either wire it through or remove it. |
| `DnsService.createRecord` | **Partial (hygiene)** | `packages/core/src/services/dns.ts:8-23` — returns a hardcoded stub `{ id: "cf-record-id" }` | Live Cloudflare writes happen via `configureDNSRecords` / `cloudflareDnsCleanupProvider`; the `DnsService` stub looks like dead/legacy code. |
| Dedicated IPs / IP pools | **Missing** | No `ConfigurationSetName` or IP-pool params in SES send calls (`emailProvider.ts`) | Resend offers dedicated IPs (paid tier). Infra + pricing decision. |

---

## 6. Automations

Resend has no automation/workflow builder — this whole area is an OpenSend **Lead**.
All items below are Present and ahead of Resend.

| Capability | Status | Evidence |
|---|---|---|
| Automation CRUD + runs API | Present (Lead) | `src/app/api/automations/route.ts:13,52`; `[id]/route.ts:29,50,96`; runs list/get/cancel/metrics under `[id]/runs/**` |
| Step types | Present (Lead) | Runner `src/lib/workers/automation-runner.ts` implements `trigger`, `delay`, `send_email`, `condition` (lines 522-567), `wait_for_event` (lines 631), `contact_update` (lines 682-861), `add_to_segment` (lines 956-982), `end` |
| Run execution | Present (Lead) | `processScheduledAutomations` driven by cron `src/app/api/internal/cron/process-scheduled/route.ts` |
| Run metrics + cancellation | Present (Lead) | `src/app/api/automations/[id]/runs/metrics/route.ts`, `[runId]/cancel/route.ts` |

**Doc-truthfulness finding:** `packages/core/src/dto/automations.ts:8` and
surrounding comments label `condition` / `wait_for_event` / `contact_update` /
`add_to_segment` as "Runner not yet built." The runner at
`src/lib/workers/automation-runner.ts` clearly executes all four. The DTO comments
are **stale** and understate the product. Fix the comments (not the code).

---

## Prioritized recommendations

Reviewed before any feature code — this audit stops here per the task constraint.

### P0 — parity-blocking / contract correctness

1. **Complete the OpenAPI spec.** `src/lib/openapi.ts` documents ~13 of ~70 routes.
   This breaks programmatic clients and violates the CLAUDE.md docs standard
   ("Do not leave implemented routes/features undocumented"). Generate or hand-author
   coverage for api-keys, segments, topics, properties, broadcasts, automations,
   webhooks, suppressions, logs, events, and receiving — plus the missing methods
   (`DELETE /api/emails`, `PATCH /api/emails/{id}`, `PATCH /api/domains/{id}`).
2. **Add a `webhooks` namespace to the TypeScript SDK.** Webhooks are a core
   resource; SDK users currently cannot create/list/update/delete or replay them.

### P1 — visible parity

3. **Resolve the Go/Python/Ruby SDK story.** They are send-only stubs. Either
   build them out toward the TS SDK surface, or — to keep `public/docs/sdks.md`
   truthful per CLAUDE.md — explicitly label them "send-only (beta)" until then.
4. **Fill TS SDK gaps:** `domains.delete`, `topics` namespace, `suppressions`/`logs`
   namespaces, and `contacts.list` pagination (`limit`/`after`).
5. **Wire or remove TLS enforcement.** The per-domain `tls` field never reaches a
   SES send call — a stored setting that does nothing is worse than no setting.
6. **Add `POST /api/suppressions`** so suppressions can be created via API, not
   just auto-suppression and dashboard.

### P2 — polish / hygiene / truthfulness

7. **Fix stale automation DTO comments** (`packages/core/src/dto/automations.ts:8`)
   — they claim runners that exist are "not yet built."
8. **Consolidate the duplicate webhook-signing implementations**
   (`packages/core/src/webhook-signing.ts` vs `src/lib/webhook-signing.ts`).
9. **Remove or implement `DnsService.createRecord`** — currently a hardcoded stub
   while real DNS writes go through a different provider.
10. **Type the automations/events SDK responses** — replace `ApiResponse<unknown>`
    with concrete types.
11. **Ship unsubscribe-page customization** or relabel the placeholder
    (`audience/topics/unsubscribe-page/edit/page.tsx`).

### Needs a Jaeyun decision (architecture / pricing / infra)

- **Dedicated IPs / IP pools** — Resend monetizes these; requires SES configuration
  sets + IP pool provisioning and a pricing model.
- **First-party SMTP relay** — currently operators relay through SES's own SMTP
  endpoint. A branded OpenSend SMTP relay is a build, not a config change.

### Not a gap (OpenSend leads — keep)

Automations, topics, segments, contact properties, templates CRUD API, a public
Logs API, and the audit log are all areas where OpenSend is ahead of Resend. No
action needed beyond keeping their docs accurate.
