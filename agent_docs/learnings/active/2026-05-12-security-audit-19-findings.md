---
date: 2026-05-12
issue: "internal-security-audit"
type: decision
promoted_to: null
---

## Security audit 2026-05-12 — 19-finding remediation plan

**What:** Internal ultra-thorough security review identified 19 findings (2 CRITICAL, 5 HIGH, 7 MEDIUM, 5 LOW) across the app, ingester, and core packages. Remediation tracked on branch `security/remediate-19-findings`.

**Why:** SSRF and MIME header injection were exploitable by any authenticated API-key holder; timing-oracle on cron/ingester tokens; CSV formula injection in exports; permissive defaults on rate-limit and Postgres password. Other findings ranged from missing security headers to plaintext-at-rest webhook signing secrets.

**Fix:** Theme-phased remediation across 6 commits (ralplan consensus, 3 iterations):

- **Phase 1** — Shared security utilities in `packages/core/src/security/`: `url-safety.ts` (SSRF with LRU DNS cache), `mime-sanitize.ts`, `timing-safe.ts`, `csv-escape.ts`, `webhook-secret-crypto.ts` (AES-256-GCM). Boot guards in `src/instrumentation.ts` and ingester for `WEBHOOK_SECRET_ENCRYPTION_KEY` + production rate-limit warning.
- **Phase 2** — Wire SSRF + MIME defenses into webhook create/dispatch and `buildMimeMessage`. Boundary entropy via `randomBytes`.
- **Phase 3** — `timingSafeStringEqual` on cron + ingester job tokens; consolidate CSV escape; SNS `SubscribeURL` allowlist; contacts import 10MB/MIME caps; `TRUSTED_PROXY_HOPS` XFF parsing.
- **Phase 4** — Drop auth-secret fallback for unsubscribe; Better Auth `trustedOrigins` + cookie pin + port fix; Next.js security headers; invites `listMembers(userId)` (two sub-commits, skip-test first); DKIM key versioning migration; webhook signing-secret AES-GCM cut-over (Migration A + backfill; Migration B drop plaintext deferred to separate gated commit).
- **Phase 5** — docker-compose hardening (Postgres password required; key passthrough); ingester bind `127.0.0.1` in prod; `listForDispatch` JSDoc; `.env.example` updates.
- **Phase 6** — CLAUDE.md Production Gotchas update; promote this file to archived.

**Pre-mortem mitigations baked in:**
1. SSRF blocklist breaking LAN webhooks → `ALLOW_PRIVATE_WEBHOOK_URLS=true` escape hatch at create; dispatch always blocks loopback/169.254.
2. `timingSafeStringEqual` CPU on huge inputs → 4 KB ceiling guard before SHA-256.
3. Postgres password change breaking self-hosters → loud warn by default; opt-in `POSTGRES_PASSWORD_ENFORCE_CHANGE` for hard fail.
4. `WEBHOOK_SECRET_ENCRYPTION_KEY` loss → manual gate on Migration B preserves plaintext column until operator confirms stability; backfill script idempotent and re-runnable.

**Principles (final):**
1. Auth and SSRF boundaries fail-closed in production; infrastructure deps degrade gracefully with mandatory structured log emission.
2. Defense in depth — validate at create AND consume.
3. One source of truth per primitive (`packages/core/src/security/*`).
4. Every fix ships with at least one Vitest unit test (Playwright E2E where user-facing).
5. Backward-compatible for self-hosters; loud actionable errors over silent breakage.

**Status:** Pre-flight baseline cleaned (stale `.next/dev/types/validator.ts` removed, missing `@react-email/render` installed). Branch `security/remediate-19-findings` cut from `main` at commit `6891d21`.
