# OpenSend Resend-Compatible Parity Gap Matrix

Generated: 2026-05-28
Current baseline: `main` at `5e3d0d4` (`docs(parity): add compatibility aliases and first-party docs`)
Source audit: `.omx/reports/resend-docs-parity-audit.md`
Private corpus use: internal coverage inspiration only. Do not copy competitor prose, layouts, examples, or navigation patterns into public OpenSend docs.

## Ground rules

OpenSend should be **Resend-compatible, not Resend-looking**. Compatibility means matching developer expectations for routes, payloads, SDK behavior, and documentation completeness where OpenSend actually supports the feature. It does not mean copying Resend documentation text, IA, screenshots, examples, visual style, or unsupported hosted-only claims.

Every checkpoint below must preserve these rules:

- Public docs are first-party OpenSend content and must not link readers to competitor docs.
- Docs must be truthful to code. Unsupported features are marked as limitations or follow-up work instead of being documented as shipped.
- Public markdown docs live under `public/docs/**/*.md` and are indexed by `public/docs/llms.txt` via `bun run docs:generate`.
- Auth, tenant, persistence, and API-sensitive implementation changes need real route/service proof and targeted tests.
- Each checkpoint ships independently through PR -> CI -> merge to `main` -> production deploy verification.

## What is already filled

The deployed PR #534 filled the first compatibility slice:

- Added first-party docs guardrails and docs QA checklist.
- Added docs quality check for the first priority API reference slice.
- Added Resend-compatible root aliases for already-implemented domains, webhooks, topics, logs, contact properties, and email read/attachments/receiving paths.
- Updated OpenAPI and docs so `/emails` documents both `GET` and `POST`, and root aliases appear in `/openapi.json`.
- Expanded API reference pages for domains, webhooks, topics, logs, contact properties, and email read/receiving.
- Verified production at `https://opensend.namuh.co/openapi.json` and public docs endpoints.

## Gap matrix by bucket

| Bucket | Current classification | Evidence | Next checkpoint |
| --- | --- | --- | --- |
| Root API aliases | Mostly implemented for core resources | Middleware aliases exist for sends, contacts, audiences/segments, broadcasts, API keys, templates, domains, webhooks, topics, logs, contact properties, and email read/receiving. The audit originally called this P0 and PR #534 closed the main missing alias families. | Re-check during API-reference work; add only if a documented implemented route still lacks a safe root path. |
| API reference depth | Implemented but underdocumented | Audit listed many terse common pages, especially broadcasts, templates, contacts, segments, suppressions, events, and API keys. PR #534 expanded only the first priority alias families. | G002 |
| Receiving/inbound | Partial product + underdocumented | Audit says received-email DB/services/API docs exist, while setup guides for receiving domains, MX records, inbound attachments/content, forwarding/replying, secure agent inboxes, and inbound webhooks are thin or missing. | G003 |
| Webhook event catalog | Implemented subset but underdocumented | Existing docs include webhook introduction, verification, retries/replays, and event types; audit calls out missing/thin event pages and private event concepts like scheduled, suppressed, and delayed. Must verify emitted events before documenting. | G004 |
| SDK/framework docs | SDKs exist, docs breadth thin | Audit found TS/Python/Go/Ruby SDKs and SMTP docs, but broad framework and integration guides are missing or stub-like (`send-with-hono.md`, `send-with-bun.md`, `send-with-express.md`, `send-with-nextjs.md`, `send-with-nodejs.md`). | G005 |
| Dashboard/product docs | Implemented areas underdocumented | Audit found many dashboard pages at six-line stub depth and missing receiving, dashboard email, settings, BIMI/regions, billing/team, webhooks storage, templates, automations, and logs docs. | G006 |
| Deliverability/support KB | Underdeveloped | Audit found 11 OpenSend KB docs vs a much larger private KB. Missing provider-specific DNS, Gmail/Outlook spam, DMARC/DKIM nuance, MX conflicts, quotas, sensitive data, account/production guidance, and suppression explanations. | G007 |
| True product gaps | Needs final evidence pass | Some gaps may be real missing product work: receiving forwarding/replying, some webhook events, broad SDK languages, no-code integrations, hosted billing/team semantics, BIMI/Apple branded mail, dedicated IP/operator-only docs. | G008 |

## Checkpoint plan

### G002 — Remaining API reference depth

Goal: make non-PR-534 API reference pages useful without implying unsupported behavior.

Scope:

- Broadcasts: create/list/get/update/delete/send.
- Templates: create/list/get/update/delete/publish/duplicate and variable/preview caveats where implemented.
- Contacts and segments/audiences: CRUD, topic/segment relationships, pagination, tenant behavior.
- Suppressions: OpenSend-specific extension; document as OpenSend-owned, not Resend parity.
- Events/custom events: document actual automation trigger surface.
- API keys: list/create/delete, token visibility, rotation caveat.
- Shared reference pages: pagination, errors, rate limits, idempotency where examples are sparse.

Implementation pattern:

1. Inspect route files and OpenAPI for each group before editing docs.
2. Expand docs with purpose, endpoint, auth, params, request examples, response examples, errors, and self-host notes.
3. Keep examples first-party (`os_...`, OpenSend host, no competitor wording).
4. Extend `tools/check-docs-quality.mjs` minimum-depth prefixes to the newly expanded groups.
5. Run `bun run docs:generate`, `bun run docs:check`, `make check`, and `make test` if OpenAPI/tooling changes.

Ship checkpoint: branch `docs/api-reference-depth-g002`, PR, CI, merge, deploy verification of representative docs and `/docs/llms.txt`.

### G003 — Receiving/inbound parity

Goal: make the receiving story coherent and truthful.

Scope:

- Audit actual inbound storage, read APIs, dashboard pages, ingester behavior, S3/MIME attachment handling, and webhook emission.
- Add/expand first-party docs for receiving overview, domain/MX setup, retrieving content and attachments, receiving webhooks, secure agent inbox pattern, and self-hosting/SES caveats.
- Mark forwarding and replying as unsupported if no implementation exists; do not imply hosted parity.
- Add small tests only if route/schema/docs tooling changes expose a correctness gap.

Validation:

- `bun run docs:generate`, `bun run docs:check`, `make check`.
- Targeted Vitest for received email services/routes if code changes.
- Playwright/API proof only if dashboard receiving or auth-sensitive behavior changes.

Ship checkpoint: branch `docs/receiving-inbound-parity-g003`, PR, CI, merge, deploy verification of receiving docs and relevant OpenAPI paths.

### G004 — Webhook event catalog and delivery docs

Goal: make webhook event behavior predictable.

Scope:

- Audit event type constants, dispatcher, ingester, SES/SNS normalization, custom events, and dashboard/API delivery surfaces.
- Document only emitted event types.
- Expand payload examples for supported events.
- Improve signing verification, retries/replays, delivery visibility, idempotency, and ingester deployment docs.
- If a docs page names an event not emitted by code, either remove/label it as planned or implement/test the event only if small and safe.

Validation:

- Unit tests for event constants/payload helpers if changed.
- Existing webhook dispatcher tests plus targeted additions when behavior changes.
- Docs generation/checks and `make check`; `make test` if code changes.

Ship checkpoint: branch `docs/webhook-event-catalog-g004`, PR, CI, merge, deploy verification.

### G005 — SDK and framework docs breadth

Goal: broaden adoption docs using actual OpenSend SDK/API behavior.

Scope:

- Expand `sdks.md`, `examples.md`, and current send guides for Node/TS, Python, Go, Ruby, SMTP.
- Expand stub framework docs: Next.js, Express, Hono, Bun.
- Add new first-party framework guides only where examples can be simple and truthful: Cloudflare Workers, AWS Lambda, Vercel/Railway, selected Python/Ruby framework examples.
- Avoid unsupported SDK language claims. PHP/Java/Rust/.NET become follow-up items unless packages exist.

Validation:

- Snippet smoke where practical via TypeScript typecheck or SDK tests.
- `bun run docs:generate`, `bun run docs:check`, `make check`.

Ship checkpoint: branch `docs/sdk-framework-guides-g005`, PR, CI, merge, deploy verification.

### G006 — Dashboard and product docs

Goal: document implemented dashboard behavior and caveats.

Scope:

- Emails dashboard: sending, attachments, tags, batch, tests if implemented, deliverability insights if implemented.
- Broadcasts, templates, contacts/audiences/segments, automations, domains, logs, topics, webhooks, suppressions.
- Settings docs for unsubscribe page, team, billing only if implemented; otherwise label hosted/operator/self-host caveats.
- BIMI, regions, Apple branded mail, dedicated IPs: docs only if implementation/operator flow exists; otherwise follow-up/limitations.

Validation:

- `bun run docs:generate`, `bun run docs:check`, `make check`.
- Playwright only for changed dashboard UI/routes.

Ship checkpoint: branch `docs/dashboard-product-g006`, PR, CI, merge, deploy verification.

### G007 — Deliverability and support KB

Goal: close operational support gaps with OpenSend-specific guidance.

Scope:

- SPF/DKIM/DMARC deep guide and DNS troubleshooting.
- Gmail/Outlook spam avoidance and warmup/consent guidance.
- DNS providers beyond existing Cloudflare/Route53/GoDaddy/Namecheap where useful and truthful.
- MX conflicts and receiving setup.
- Suppression reasons, topics/unsubscribe, sensitive data, API key handling.
- Quotas/rate limits/production access with OpenSend Cloud vs self-host distinctions.

Validation:

- `bun run docs:generate`, `bun run docs:check`, `make check`.
- Manual spot-check of links and provider examples.

Ship checkpoint: branch `docs/deliverability-kb-g007`, PR, CI, merge, deploy verification.

### G008 — Final parity audit, cleanup, and review gate

Goal: finish the durable run honestly.

Scope:

- Re-run docs corpus comparison after G002-G007.
- Update this gap matrix with closed/open status.
- Ensure `public/docs/llms.txt` is current and public docs contain no competitor links or copied competitor wording.
- Record remaining true product gaps as follow-up issues/docs with clear classifications.
- Run final verification, ai-slop-cleaner, independent code review and architect review per Ultragoal final gate.

Validation:

- `bun run docs:generate`, `bun run docs:check`, `make check`, `make test` if code changed in final sweep.
- Final production spot-checks for representative docs/API paths.

Ship checkpoint: branch `docs/parity-final-audit-g008`, PR, CI, merge, deploy verification, then complete the aggregate Codex goal.

## Remaining true product-gap candidates to verify before documenting as supported

These should not be described as shipped until code proves them:

- Inbound forwarding and reply workflows.
- `email.delivery_delayed`, `email.scheduled`, and `email.suppressed` webhook emissions.
- BIMI and Apple branded mail setup beyond general deliverability advice.
- Hosted team/billing behaviors vs self-host/operator-only modes.
- Broad SDK language parity beyond TypeScript/Python/Go/Ruby.
- No-code/CMS/notification integrations that require product-specific UI or provider setup.
- Dedicated IP automation vs operator-managed infrastructure.

