# OpenSend ↔ Resend parity matrix

Authoritative tracker for the parity-driven autonomous loop (`hermes-orchaestrator/skills/autonomous-ai-agents/opensend-orchestrator/references/parity-driven-loop.md`).

The parity-inspector reads this file each tick, picks the highest-priority unfiled gap, files a spec issue, and updates the row's `Issue #`. Manually-filed parity issues should also be backfilled into the relevant row in the same PR — otherwise the inspector will re-file.

**Columns**

- **Area** — broad category
- **Feature** — concrete capability
- **Resend** — short summary of how Resend ships it (cite docs URL when non-obvious)
- **OpenSend** — short summary of current behavior (cite `path:line` when applicable)
- **Feature gap** — `parity` / `partial` / `missing` / `lead`
- **DX gap** — API ergonomics, SDK quality, error messages, types, idempotency. `parity` / `behind` / `ahead`
- **Reliability gap** — SLO, multi-region, retry, replay, observability. `parity` / `behind` / `ahead`
- **Price gap** — what we'd charge vs Resend at equivalent volume. `cheaper` / `match` / `pricier` / `n/a`
- **Priority** — `P0` (closes a customer-blocking gap) / `P1` (visible parity) / `P2` (polish) / `needs Jaeyun` (architecture/pricing/infra decision)
- **Issue #** — populated by inspector when filed; empty = unfiled
- **Last reviewed** — UTC date the row was last verified against repo + Resend docs

Rows are ordered roughly by priority within each area. The inspector's tie-breaker is "smallest implementable slice first".

---

## Transactional API

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Single send (`POST /emails`) | core, stable, idempotency-keyed | TBD | ? | ? | ? | ? | P1 | | |
| Batch send (`POST /emails/batch`) | up to 100/req | TBD | ? | ? | ? | ? | P1 | | |
| Scheduled send (`scheduled_at`) | natural-language + ISO | TBD | ? | ? | ? | ? | P1 | | |
| Cancel scheduled send | `PATCH /emails/:id` | TBD | ? | ? | ? | ? | P2 | | |
| Idempotency keys | `Idempotency-Key` header | TBD | ? | ? | ? | ? | P0 | | |
| Reply-To list | array | TBD | ? | ? | ? | ? | P2 | | |
| Attachments | base64 + URL fetch | TBD | ? | ? | ? | ? | P1 | | |
| Tags / metadata | `tags[]` for analytics filter | TBD | ? | ? | ? | ? | P1 | | |

## Audiences / Broadcasts

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Audiences (lists) | CRUD | TBD | ? | ? | ? | ? | P1 | | |
| Contacts | CRUD, unsub state | TBD | ? | ? | ? | ? | P1 | | |
| Broadcasts | create/preview/send | TBD | ? | ? | ? | ? | P1 | | |
| Segments | filter by attributes | TBD | ? | ? | ? | ? | P2 | | |
| Unsubscribe management | hosted page + List-Unsubscribe header ([docs](https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails)); broadcasts auto-handle `{{{RESEND_UNSUBSCRIBE_URL}}}` ([docs](https://resend.com/docs/dashboard/broadcasts/introduction)) | partial: hosted `/unsubscribe/[contactId]` page calls auth-protected contact PATCH (`src/app/unsubscribe/[contactId]/page.tsx:17`, `src/app/api/contacts/[id]/route.ts:70`); send APIs only persist caller headers (`src/app/api/emails/route.ts:293`, `src/app/api/emails/batch/route.ts:176`); broadcast footer placeholder is not wired to a generated URL (`src/components/broadcast-editor.tsx:97`, `src/components/broadcast-editor.tsx:1310`) | partial | behind | behind | n/a | P0 | #173 | 2026-05-03 |

## Domains

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Custom domain add | DNS records emitted, verify endpoint | TBD | ? | ? | ? | ? | P0 | | |
| DKIM/SPF/DMARC | auto-configured records | TBD | ? | ? | ? | ? | P0 | | |
| Multi-region domain | EU + US-East + others | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| Subdomain delegation (CNAME) | `send.foo.com` pattern | TBD | ? | ? | ? | ? | P2 | | |

## Webhooks

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Event types (sent/delivered/opened/clicked/bounced/complained) | full set | TBD | ? | ? | ? | ? | P0 | | |
| Signing (HMAC SHA256, `Resend-Signature`) | yes | TBD | ? | ? | ? | ? | P0 | | |
| Retries with backoff | yes | TBD | ? | ? | ? | ? | P0 | | |
| Replay from dashboard | yes | TBD | ? | ? | ? | ? | P1 | | |
| Per-event filtering at endpoint | yes | TBD | ? | ? | ? | ? | P2 | | |

## Templates

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| React Email integration | first-class | TBD | ? | ? | ? | ? | P1 | | |
| Variable interpolation | yes | TBD | ? | ? | ? | ? | P1 | | |
| Stored templates (server-side render) | yes | TBD | ? | ? | ? | ? | P2 | | |

## Analytics

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Delivery stats | by domain/tag/date | TBD | ? | ? | ? | ? | P1 | | |
| Open / click tracking | yes (with privacy toggles) | TBD | ? | ? | ? | ? | P1 | | |
| Bounce / complaint feed | exportable | TBD | ? | ? | ? | ? | P1 | | |
| CSV export | yes | TBD | ? | ? | ? | ? | P2 | | |

## API & SDKs

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| OpenAPI spec | published | TBD | ? | ? | ? | ? | P1 | | |
| Node SDK | first-class | TBD | ? | ? | ? | ? | P0 | | |
| Python SDK | first-class | TBD | ? | ? | ? | ? | P1 | | |
| Go SDK | yes | TBD | ? | ? | ? | ? | P1 | | |
| Ruby / PHP / .NET / Rust SDKs | yes | TBD | ? | ? | ? | ? | P2 | | |
| MCP server | yes | TBD | ? | ? | ? | ? | P1 | | |
| TypeScript types | strict, exported | TBD | ? | ? | ? | ? | P0 | | |

## DX

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Sandbox / test mode | dedicated `onboarding@resend.dev` + test API key behavior | TBD | ? | ? | ? | ? | P1 | | |
| Error message quality | documented error catalog with stable names and suggested actions ([docs](https://resend.com/docs/api-reference/errors)) | partial: send routes return ad hoc string errors/details (`src/app/api/emails/route.ts:93`, `src/app/api/emails/batch/route.ts:102`); SDK exposes only `message`/`statusCode` (`packages/sdk/src/index.ts:30`) | partial | behind | parity | n/a | P0 | #170 | 2026-05-03 |
| Logs / event explorer | searchable per email | TBD | ? | ? | ? | ? | P0 | | |
| Dashboard quality | polished, fast | TBD | ? | ? | ? | ? | P1 | | |
| API key scopes | read/write/full per key | TBD | ? | ? | ? | ? | P1 | | |

## Reliability

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Public SLO | implied via status page | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| Multi-region send | EU/US/AP | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| Status page | yes | TBD | ? | ? | ? | ? | P1 | | |
| Queue under provider degradation | retries, dead-letter | TBD | ? | ? | ? | ? | P0 | | |
| Send-time observability (per-message trace) | event timeline per email_id | TBD | ? | ? | ? | ? | P1 | | |

## Compliance / security

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| SOC2 | yes | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| GDPR / EU data residency | yes | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| Audit log | yes | TBD | ? | ? | ? | ? | P1 | | |
| Suppression list management | yes | TBD | ? | ? | ? | ? | P0 | | |

## Pricing

| Feature | Resend | OpenSend | Feature | DX | Reliability | Price | Priority | Issue # | Last reviewed |
|---|---|---|---|---|---|---|---|---|---|
| Free tier | 3K/mo, 100/day | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| Paid tiers | $20/50K → scaled | TBD | ? | ? | ? | ? | needs Jaeyun | | |
| Enterprise | custom | TBD | ? | ? | ? | ? | needs Jaeyun | | |

---

## Maintenance

- **Inspector tick** auto-updates `Issue #` and `Last reviewed` when it files.
- **Manual sweeps** are needed when columns drift (Resend ships something new, OpenSend ships outside the loop). Update the affected row in the same PR.
- **`needs Jaeyun` rows** are skipped by the inspector — sweep them with Jaeyun periodically; either downgrade to a P-tier with concrete scope, or accept they stay parked.
- **`TBD` cells** in the OpenSend column are the inspector's first-pass job: fill them by reading the repo before filing the issue. The first few inspector ticks will mostly be matrix-fill, not issue-filing — that's expected.
