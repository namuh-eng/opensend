# Resend parity audit — OpenSend (2026-05-23)

Branch: `resend-parity-audit` · Base: `origin/main` · Method: code/route/OpenAPI inspection (no feature work).

This started as a point-in-time **audit** — the gap matrix and prioritized
recommendations below were produced first, with no feature code. The
implementation pass that followed is recorded in the **Resolution log**
immediately below; the gap tables and recommendations are then annotated with
their resolution inline.

Resend was used only as private parity inspiration — no competitor links appear
here or in any public-facing file.

---

## Resolution log — 2026-05-23 implementation pass

Every recommendation in this audit was implemented on branch `resend-parity-audit`.
`make check` (typecheck + Biome) and `make test` (1465 Vitest tests) pass.

| # | Recommendation | Status | Commit |
|---|---|---|---|
| P0-1 | Complete the OpenAPI spec (~13 → ~60 paths) | ✅ Done | `23500f9` |
| P0-2 | `webhooks` namespace in the TypeScript SDK | ✅ Done | `568c3ae` |
| P1-3 | Build out Go / Python / Ruby SDKs to full surface | ✅ Done | `b2890c3`, `5ef00e9`, `899dd9c` |
| P1-4 | TS SDK gaps — `domains.delete`, `topics`, `suppressions`/`logs`, `contacts.list` paging | ✅ Done | `568c3ae` |
| P1-5 | Wire TLS enforcement through SES | ✅ Done | `68799cf` |
| P1-6 | `POST /api/suppressions` | ✅ Done | `a61a689` |
| P2-7 | Fix stale automation DTO comments | ✅ Done | `4d5caca` |
| P2-8 | Consolidate duplicate webhook-signing implementations | ✅ Done | `4d5caca` |
| P2-9 | Remove the `DnsService.createRecord` stub | ✅ Done | `4d5caca` |
| P2-10 | Type the automations/events SDK responses | ✅ Done | `568c3ae` |
| P2-11 | Ship unsubscribe-page customization | ✅ Done | `4a19d16` |
| Decision | Dedicated IPs / IP pools | ✅ Built — full feature, plan-gated, SES configuration sets | `68799cf` |
| Decision | First-party SMTP relay | ✅ Built — `@opensend/smtp-relay`, API-key auth | `1469909` |

The Go/Python/Ruby SDKs now each expose 14 resource namespaces (Go: 75 tests;
Python: 82; Ruby: 96 — all passing). TLS enforcement and dedicated-IP routing
share one SES configuration set per domain (`DeliveryOptions.TlsPolicy` +
`SendingPoolName`). The two "needs a decision" items were both built in full at
the user's direction.

## Legend

- **Present** — parity in code with Resend's documented behavior.
- **Partial** — implemented but with a material gap.
- **Missing** — not implemented.
- **Lead** — OpenSend ships this where Resend does not (parity is not at risk; noted for completeness).

---

## Summary scoreboard

Each cell shows **at audit time → after the implementation pass**.

| Area | Present | Partial | Missing |
|---|---|---|---|
| API (REST) | 9 → 12 | 3 → 1 | 1 → 0 |
| SDK | 2 → 5 | 5 → 1 | 3 → 0 |
| Dashboard | 13 → 14 | 1 → 0 | 0 → 0 |
| Webhooks | 5 → 6 | 1 → 0 | 0 → 0 |
| Deliverability | 6 → 9 | 2 → 0 | 1 → 0 |
| Automations | 4 (all Lead) | 0 | 0 |

The only remaining Partial cells are scheduled-send natural-language parsing
(API, pre-existing — tracked in `agent_docs/resend-parity.md` #240) and
automatic SDK retries (a minor DX item; Resend's own SDKs are also thin here).

Headline findings (at audit time — all now resolved, see the Resolution log):

1. **REST surface is broad and close to parity** — emails, domains, API keys,
   audiences, contacts, broadcasts all Present with idempotency keys and the
   `full_access`/`sending_access` permission model.
2. ~~**OpenAPI spec is ~13 of ~70 routes**~~ — **resolved** (`23500f9`): the
   spec now covers the full public REST surface (~60 paths).
3. ~~**Only the TypeScript SDK is real**~~ — **resolved** (`b2890c3`, `5ef00e9`,
   `899dd9c`): Go/Python/Ruby SDKs each now expose 14 resource namespaces.
4. ~~**TS SDK omits `webhooks` and `topics`**~~ — **resolved** (`568c3ae`):
   `webhooks`, `topics`, `suppressions`, `logs` namespaces and `domains.delete`
   added.
5. **Automations are a genuine lead** over Resend; the stale DTO comments that
   understated the runner were corrected (`4d5caca`).

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
| Suppressions API | Present *(was Partial)* | `src/app/api/suppressions/route.ts` GET + **POST** (`a61a689`), `[email]/route.ts` (DELETE) | `POST /api/suppressions` now creates manual suppressions; idempotent upsert, `"manual"` reason. |
| Scheduled send (natural language) | **Partial** | `scheduled_at` accepted in send validation; worker scans due rows | Per existing tracker (`agent_docs/resend-parity.md`, #240): handlers use raw `new Date(...)`, so `in 1 min`-style strings are not normalized. Carried forward; the only remaining API Partial. |
| OpenAPI contract completeness | Present *(was Partial)* | `src/lib/openapi.ts` now declares ~60 paths (`23500f9`) | Full public REST surface documented; satisfies the CLAUDE.md docs standard. |
| First-party SMTP relay | Present *(was Missing)* | `packages/smtp-relay/` — `@opensend/smtp-relay`, a standalone Bun SMTP server (`1469909`) | API key as the SMTP password; injects into the same delivery pipeline as the REST API. `public/docs/send-with-smtp.md` rewritten as a first-party guide. |

OpenSend leads not present in Resend's public API: a **Logs API**
(`src/app/api/logs/route.ts:7`, `[id]/route.ts:7` — Resend keeps logs dashboard-only),
**templates CRUD** (`src/app/api/templates/**`, `src/app/api/public/templates/**`),
**topics**, **segments**, **contact properties** (`src/app/api/properties/**`),
and a **custom-events API** (`src/app/api/events/route.ts`, `events/send/route.ts`).

### 1.1 OpenAPI spec gap (detail) — RESOLVED (`23500f9`)

> **Resolved.** `src/lib/openapi.ts` was expanded from ~13 to ~60 path entries
> covering api-keys, segments, topics, properties, broadcasts, automations,
> webhooks, suppressions, logs, events, and receiving, plus the previously
> undeclared methods (`DELETE /api/emails`, `PATCH /api/emails/{id}`,
> `PATCH /api/domains/{id}`). The dedicated-IP and unsubscribe-page routes
> added in this pass are documented too. The text below describes the
> pre-resolution state.

At audit time `src/lib/openapi.ts` declared only: `/emails`, `/emails/batch`,
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
At audit time OpenSend shipped four SDK packages — one complete, three
send-only stubs. **All three stubs were built out** to the full surface in
this pass.

| SDK | Status | Evidence | Gap note |
|---|---|---|---|
| TypeScript (`packages/sdk/`, npm `opensend` v0.1.0) | Present | `packages/sdk/src/index.ts` — namespaces now also include `webhooks`, `topics`, `suppressions`, `logs` (`568c3ae`) | Strict, no `any`; `Resend` alias class retained. |
| Go (`packages/go-sdk/`) | Present *(was Partial)* | 14 resource files (`emails.go`, `domains.go`, …) — `b2890c3`; 75 tests | Built out from send-only to the full surface. |
| Python (`packages/python-sdk/`) | Present *(was Partial)* | 14 resource modules under `src/opensend/` — `5ef00e9`; 82 tests | Built out from send-only to the full surface. |
| Ruby (`packages/ruby-sdk/`) | Present *(was Partial)* | 14 resource classes under `lib/opensend/resources/` — `899dd9c`; 96 tests | Built out from send-only to the full surface. |
| MCP server (`packages/mcp/`) | Present | 12 tools in `packages/mcp/src/schema.ts` (send/list/get email, create/list/get contact, create/list/get domain, create/list/get webhook); stdio + http transports (`stdio.ts`, `http.ts`) | Resend also ships an MCP server — at parity. |

TypeScript SDK gaps at audit time vs the REST surface it should cover — all
closed in `568c3ae` except the minor retries DX item:

| SDK gap | Status | Resolution |
|---|---|---|
| `webhooks` namespace | Present *(was Missing)* | `Webhooks` class + constructor wiring added. |
| `topics` namespace | Present *(was Missing)* | `Topics` class added. |
| `suppressions` / `logs` namespaces | Present *(was Missing)* | Both namespaces added. |
| `domains.delete` | Present *(was Partial)* | `Domains.delete` calls `DELETE /api/domains/:id`. |
| `contacts.list` pagination | Present *(was Partial)* | `contacts.list` accepts `limit`/`after`. |
| `automations`/`events` response typing | Present *(was Partial)* | Concrete types replace `ApiResponse<unknown>`. |
| Automatic retries | **Partial** (DX) | `HttpClient` still has no retry logic — minor; Resend's SDKs are also thin here. The only remaining SDK Partial. |

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
| Unsubscribe-page customization | Present *(was Partial)* | Real editor at `src/app/(dashboard)/audience/topics/unsubscribe-page/edit/page.tsx` backed by `unsubscribe_page_settings` table + `PUT /api/unsubscribe-page` (`4a19d16`) | Operators set brand color, logo, headline, message, footer; applied at render in `src/app/unsubscribe/[contactId]/route.ts` with HTML-escaping and re-validated color/logo. |

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
| Signing-code duplication | Resolved *(was Partial)* | `src/lib/webhook-signing.ts` now re-exports `packages/core/src/webhook-signing.ts` — single implementation (`4d5caca`) | One canonical signer; the drift risk is gone. |

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
| TLS enforcement | Present *(was Partial)* | The per-domain `tls` setting now drives `DeliveryOptions.TlsPolicy` (`REQUIRE`/`OPTIONAL`) on the domain's SES configuration set (`68799cf`) | `require` rejects delivery over un-encrypted transport; `opportunistic` keeps SES's default. No longer inert. |
| `DnsService.createRecord` | Resolved *(was Partial)* | The hardcoded stub was removed; callers use `configureDNSRecords` / `cloudflareDnsCleanupProvider` directly (`4d5caca`) | Dead legacy code eliminated. |
| Dedicated IPs / IP pools | Present *(was Missing)* | `dedicated_ip_pools` table + `POST/GET/DELETE /api/dedicated-ips` (`68799cf`); plan-gated; binds an SES `SendingPoolName` onto the domain configuration set | Full feature built at the user's direction. Live AWS pool provisioning is a separate operator-run step (billable). |

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

**Doc-truthfulness finding — resolved (`4d5caca`):** `packages/core/src/dto/automations.ts`
previously labelled `condition` / `wait_for_event` / `contact_update` /
`add_to_segment` as "Runner not yet built," contradicting the runner at
`src/lib/workers/automation-runner.ts` which executes all four. The stale comments
were corrected to describe the implemented behavior.

---

## Prioritized recommendations

These were drafted at audit time, before any feature code. The implementation
pass that followed closed **every** item — each is annotated ✅ with its commit.
See the Resolution log at the top for the consolidated table.

### P0 — parity-blocking / contract correctness

1. ✅ **(`23500f9`) Complete the OpenAPI spec.** Was ~13 of ~70 routes. Now
   `src/lib/openapi.ts` declares ~60 paths covering api-keys, segments, topics,
   properties, broadcasts, automations, webhooks, suppressions, logs, events, and
   receiving — plus the previously undeclared methods (`DELETE /api/emails`,
   `PATCH /api/emails/{id}`, `PATCH /api/domains/{id}`).
2. ✅ **(`568c3ae`) Add a `webhooks` namespace to the TypeScript SDK.** `Webhooks`
   class wired into the client constructor.

### P1 — visible parity

3. ✅ **(`b2890c3`, `5ef00e9`, `899dd9c`) Build out the Go/Python/Ruby SDKs.** No
   longer send-only stubs — each now exposes 14 resource namespaces matching the
   TS SDK surface (Go 75 tests, Python 82, Ruby 96, all passing).
4. ✅ **(`568c3ae`) Fill TS SDK gaps:** `domains.delete`, `topics` namespace,
   `suppressions`/`logs` namespaces, and `contacts.list` pagination added.
5. ✅ **(`68799cf`) Wire TLS enforcement.** The per-domain `tls` setting now drives
   `DeliveryOptions.TlsPolicy` on the domain's SES configuration set.
6. ✅ **(`a61a689`) Add `POST /api/suppressions`** — manual suppressions can now be
   created via API (idempotent upsert, `"manual"` reason).

### P2 — polish / hygiene / truthfulness

7. ✅ **(`4d5caca`) Fixed stale automation DTO comments** in
   `packages/core/src/dto/automations.ts`.
8. ✅ **(`4d5caca`) Consolidated the webhook-signing implementations** —
   `src/lib/webhook-signing.ts` re-exports the `@opensend/core` signer.
9. ✅ **(`4d5caca`) Removed the `DnsService.createRecord` stub** — real DNS writes
   go through `configureDNSRecords` / `cloudflareDnsCleanupProvider`.
10. ✅ **(`568c3ae`) Typed the automations/events SDK responses** — concrete types
    replace `ApiResponse<unknown>`.
11. ✅ **(`4a19d16`) Shipped unsubscribe-page customization** — real editor backed
    by the `unsubscribe_page_settings` table and `PUT /api/unsubscribe-page`.

### Needed a decision (architecture / pricing / infra) — both built

- ✅ **(`68799cf`) Dedicated IPs / IP pools** — `dedicated_ip_pools` table +
  `POST/GET/DELETE /api/dedicated-ips`, plan-gated, binds an SES `SendingPoolName`
  onto the domain configuration set. Built in full at the user's direction. Live
  AWS pool provisioning (`aws sesv2 create-dedicated-ip-pool`) is a separate,
  billable operator step.
- ✅ **(`1469909`) First-party SMTP relay** — `@opensend/smtp-relay`, a standalone
  Bun SMTP server that accepts an API key as the SMTP password and injects into
  the same delivery pipeline as the REST API.

### Not a gap (OpenSend leads — keep)

Automations, topics, segments, contact properties, templates CRUD API, a public
Logs API, and the audit log are all areas where OpenSend is ahead of Resend. No
action needed beyond keeping their docs accurate.
