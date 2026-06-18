# OpenSend Resend-Compatible Parity Gap Matrix

Generated: 2026-05-28
Current baseline: final G008 audit branch after G007 baseline `8bb7d4b`.
Source audit: `.omx/reports/resend-docs-parity-audit.md`, repo route/source inspection, and production spot checks from the G001-G007 Ultragoal ledger.
Private corpus use: internal coverage inspiration only. Public OpenSend docs must remain first-party, OpenSend-owned, and not competitor-looking.

## Ground rules

OpenSend should be **Resend-compatible, not Resend-looking**. Compatibility means matching developer expectations for routes, payloads, SDK behavior, and documentation completeness where OpenSend actually supports the feature. It does not mean copying competitor documentation text, information architecture, examples, screenshots, visual style, or unsupported hosted-only claims.

Every checkpoint preserved these rules:

- Public docs are first-party OpenSend content and do not link readers to competitor docs.
- Docs are truthful to code. Unsupported features are marked as limitations or follow-up work instead of being documented as shipped.
- Public markdown docs live under `public/docs/**/*.md` and are indexed by `public/docs/llms.txt` via `bun run docs:generate`.
- Auth, tenant, persistence, and API-sensitive implementation changes received targeted route/service tests.
- Each checkpoint shipped independently through PR -> CI -> merge to `main` -> production deploy verification.

## Shipped checkpoint summary

| Goal | Status | Merge/deploy evidence | What changed |
| --- | --- | --- | --- |
| G001 detailed parity plan/gap matrix | Complete | PR #535, deploy run `26525453487` | Created this durable gap matrix and first-party docs guardrails. |
| G002 remaining API reference depth | Complete | PR #536, deploy run `26526046413` | Expanded API reference pages for broadcasts, templates, contacts, segments/audiences, suppressions, events, API keys, pagination/errors/rate limits/idempotency. |
| G003 receiving and inbound parity | Complete | PR #538, deployed via workflow/manual ECS verification | Documented receiving setup/content/attachments/agent inbox, fixed received email tenant scoping, and labeled inbound MIME ingestion as operator-owned until implemented. |
| G004 webhook event catalog/delivery docs | Complete | PR #540, deploy run `26528088824` | Documented emitted webhook events, Svix-compatible headers, retries/replays, delivery pages, and reserved `email.received` caveat. |
| G005 SDK/framework docs breadth | Complete | PR #543, deploy run `26529071680` | Expanded TypeScript/Python/Go/Ruby/SMTP docs and added Node, Bun, Next.js, Express, Hono, Workers, Lambda, Vercel, Railway, FastAPI, Flask, Django, Rails, and Sinatra guides. |
| G006 dashboard/product docs | Complete | PR #544, deploy run `26529766000`, ECS app `opensend-app:40` | Expanded dashboard docs for emails, broadcasts, domains, automations, templates, audience, topics, logs, webhooks, API keys, and suppressions boundaries. |
| G007 deliverability/support KB | Complete | PR #545, deploy run `26530381866`, ECS app `opensend-app:41` | Expanded DNS provider, SPF/DKIM/DMARC, spam, warmup, consent, suppressions, MX/receiving, quotas/rate limits, and API key KB docs. |
| G008 final audit/cleanup/review | Complete in this checkpoint | Final branch validation and independent review gate | Re-ran docs corpus checks, removed public competitor-doc links, updated this matrix, ran final verification, ai-slop-cleaner, and independent code-reviewer/architect review. |

## Final bucket status

| Bucket | Final classification | Evidence | Follow-up |
| --- | --- | --- | --- |
| Root API aliases | Mostly implemented for documented core resources | Middleware aliases cover sends, contacts, audiences/segments, broadcasts, API keys, templates, domains, webhooks, topics, logs, contact properties, and email read/receiving paths. OpenAPI/docs were expanded across G002-G004. | Re-check when new resources are added; avoid aliases that collide with dashboard pages without explicit API signals. |
| API reference depth | Documentation gap closed for implemented surface | G002 expanded sparse reference families and docs quality checks now cover the priority API reference prefixes. | Product gaps below remain separate from docs depth. |
| Receiving/inbound | Truthful partial parity | G003 docs and tests show read APIs/storage/dashboard receiving docs exist; automatic inbound MIME ingestion/forwarding/replying are operator-owned or unsupported unless a deployment implements them. | Implement inbound parser, forwarding, and reply workflows before documenting as shipped. |
| Webhook event catalog | Documentation gap closed for emitted subscription events | G004 docs test requires every `SUPPORTED_WEBHOOK_EVENT_TYPES` entry to have a public docs page; docs use actual `svix-*` headers and retry schedule. | Implement additional events before listing them as subscribeable. |
| SDK/framework docs | Documentation gap closed for existing SDKs/runtimes | G005 added first-party guides for existing TypeScript/Python/Go/Ruby SDKs, SMTP relay, and REST/fetch runtime patterns. | New SDK language packages remain product work. |
| Dashboard/product docs | Documentation gap substantially closed | G006 expanded docs for implemented dashboard areas and explicitly labeled the missing dedicated suppressions UI. | Add docs when settings/team/billing/dedicated-IP/BIMI product surfaces mature. |
| Deliverability/support KB | Documentation gap substantially closed | G007 expanded operational support docs and separated app limits, hosted quotas, and SES/provider limits. | Continue adding provider-specific KB entries as real support cases appear. |
| Public competitor-doc leakage | Fixed in G008 | Final audit found old dashboard bounce-rate links to competitor docs and replaced them with OpenSend docs; `tests/docs-content.test.ts` now scans `public/docs`, `src/app`, and `src/components`. | Keep competitor docs internal only. |

## Remaining true product gaps and non-goals

These should **not** be documented as shipped parity until code proves them:

- Automatic inbound MIME ingestion, inbound forwarding, and reply workflows for receiving domains.
- Additional webhook emissions such as scheduled/delayed/suppressed variants unless implemented and tested.
- BIMI, Apple branded mail, and dedicated IP automation beyond operator/support guidance.
- Hosted team/billing semantics beyond currently implemented dashboard/pricing flows.
- Broad SDK language parity beyond TypeScript, Python, Go, and Ruby packages.
- No-code/CMS/provider integrations that require product-specific UI or provider setup.
- Rich export center for every dashboard resource; current exports are mixed and should not be overclaimed.
- Advanced per-message tracing and tag-based metrics filters beyond currently implemented logs/events/metrics surfaces.

## Final verification requirements

The final G008 gate must include:

- `bun run docs:generate`
- `bun run docs:check`
- `make check`
- `make test`
- production spot checks for `/docs/llms.txt`, representative API/docs pages, and the final docs added in G005-G007
- ai-slop-cleaner report scoped to the final changed files
- independent code-reviewer and architect review evidence with `APPROVE` and `CLEAR`
